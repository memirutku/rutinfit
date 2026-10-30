import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SetupWizard } from "@/components/onboarding/SetupWizard";
import type { Profile } from "@/lib/schemas/profile";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

const PROFILE: Profile = {
  id: "default-user",
  heightCm: 181,
  age: 25,
  sex: "male",
  currentWeightKg: 112,
  calorieTarget: 2080,
  calorieCeiling: 2100,
  proteinTargetG: 165,
  fatTargetG: 60,
  carbTargetG: 220,
  wakeTime: "06:30",
  workdayHomeTime: "19:30",
  isOnboarded: false,
};

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  restore = undefined;
});

const next = () => fireEvent.click(screen.getByRole("button", { name: "İleri" }));

function fillBody(age = "25", height = "181", weight = "112") {
  fireEvent.change(screen.getByLabelText("Yaş"), { target: { value: age } });
  fireEvent.change(screen.getByLabelText("Boy (cm)"), { target: { value: height } });
  fireEvent.change(screen.getByLabelText("Kilo (kg)"), { target: { value: weight } });
}

describe("F09: kurulum sihirbazı", () => {
  it("dört adımda hedefi hesaplar, özeti gösterir ve profili kaydeder", async () => {
    const s = stubFetch([["/api/profile", (_u, init) => jsonResponse({ ...PROFILE, ...JSON.parse(String(init?.body ?? "{}")) })]]);
    restore = s.restore;
    const onClose = vi.fn();
    renderWithQuery(<SetupWizard open profile={PROFILE} onClose={onClose} />);

    // 1. Vücut: kurulmamış profilde şema varsayılanları (181 cm, 112 kg) gösterilmez.
    expect((screen.getByLabelText("Boy (cm)") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Kilo (kg)") as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("button", { name: "İleri" }) as HTMLButtonElement).disabled).toBe(true);
    fillBody();
    next();
    // 2. Hareket
    fireEvent.click(screen.getByRole("radio", { name: /Hafif hareketli/ }));
    next();
    // 3. Hedef
    fireEvent.click(screen.getByRole("radio", { name: "Kilo ver" }));
    fireEvent.change(screen.getByLabelText("Hedef kilo (kg)"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Haftalık hız"), { target: { value: "0.5" } });
    expect(screen.getByText(/Güvenli üst sınır: 1,1 kg/)).toBeTruthy();
    next();
    // 4. Özet
    expect(screen.getByText("2.930 kcal")).toBeTruthy();
    expect(screen.getByText(/2\.380 kcal/)).toBeTruthy();
    expect(screen.getByText(/03\.09\.2027/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Kaydet ve başla" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const put = s.calls.find((c) => c.init?.method === "PUT")!;
    expect(JSON.parse(String(put.init?.body))).toMatchObject({
      calorieTarget: 2380,
      calorieCeiling: 2480,
      proteinTargetG: 162,
      activityLevel: "light",
      goalType: "lose",
      goalRateKgPerWeek: 0.5,
      targetWeightKg: 90,
      wakeTime: "06:30",
      isOnboarded: true,
    });
  });

  it("kurulmuş profilde sihirbaz mevcut ölçülerle açılır", () => {
    restore = stubFetch([["/api/profile", () => jsonResponse(PROFILE)]]).restore;
    renderWithQuery(<SetupWizard open profile={{ ...PROFILE, isOnboarded: true }} onClose={vi.fn()} />);
    expect((screen.getByLabelText("Boy (cm)") as HTMLInputElement).value).toBe("181");
    expect((screen.getByLabelText("Kilo (kg)") as HTMLInputElement).value).toBe("112");
  });

  it("geçersiz vücut değerinde ilerlemez; 'Şimdilik geç' kaydetmeden kapatır", () => {
    const s = stubFetch([["/api/profile", () => jsonResponse(PROFILE)]]);
    restore = s.restore;
    const onClose = vi.fn();
    renderWithQuery(<SetupWizard open profile={PROFILE} onClose={onClose} />);
    fillBody("25", "181", "8");
    expect((screen.getByRole("button", { name: "İleri" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Şimdilik geç" }));
    expect(onClose).toHaveBeenCalled();
    expect(s.calls.filter((c) => c.init?.method === "PUT")).toHaveLength(0);
  });

  it("'Kiloyu koru' seçilince hedef kilo ve hız sorulmaz; hedef TDEE olur", () => {
    restore = stubFetch([["/api/profile", () => jsonResponse(PROFILE)]]).restore;
    renderWithQuery(<SetupWizard open profile={PROFILE} onClose={vi.fn()} />);
    fillBody();
    next();
    fireEvent.click(screen.getByRole("radio", { name: /Hafif hareketli/ }));
    next();
    fireEvent.click(screen.getByRole("radio", { name: "Kiloyu koru" }));
    expect(screen.queryByLabelText("Hedef kilo (kg)")).toBeNull();
    next();
    expect(screen.getAllByText(/2\.930 kcal/).length).toBeGreaterThanOrEqual(2);
  });
});
