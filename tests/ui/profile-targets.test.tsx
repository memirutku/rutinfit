import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProfileTargetsSection } from "@/components/settings/ProfileTargetsSection";
import { DEFAULT_TARGETS } from "@/lib/constants";
import type { Profile } from "@/lib/schemas/profile";
import { jsonResponse, stubFetch } from "../helpers/fetch";
import { renderWithQuery } from "../helpers/query";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const PROFILE: Profile = {
  id: "default-user",
  heightCm: 160,
  age: 41,
  sex: "female",
  currentWeightKg: 78,
  calorieTarget: 2080,
  calorieCeiling: 2100,
  proteinTargetG: 165,
  fatTargetG: 60,
  carbTargetG: 220,
  wakeTime: "06:00",
  workdayHomeTime: "18:00",
  isOnboarded: true,
};

const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;

describe("B15: kalori hedefi değişince makrolar", () => {
  it("toplam uyuşmazsa uyarır; 'oranla dağıt' makroları yeni hedefe göre günceller ve kaydeder", async () => {
    const s = stubFetch([["/api/profile", (_u, init) => jsonResponse({ ...PROFILE, ...JSON.parse(String(init?.body)) })]]);
    restore = s.restore;
    renderWithQuery(<ProfileTargetsSection profile={PROFILE} />);
    expect(screen.queryByRole("status", { name: "Makro dengesi" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Kalori Hedefi (kcal)"), { target: { value: "1500" } });
    const warning = screen.getByRole("status", { name: "Makro dengesi" });
    expect(warning.textContent).toContain("2.080 kcal");
    expect(warning.textContent).toContain("1.500 kcal");
    expect(warning.textContent).toContain("580 kcal");
    expect(warning.textContent).toContain("Protein 119 g · Karbonhidrat 159 g · Yağ 43 g");

    fireEvent.click(screen.getByRole("button", { name: "Makroları oranla dağıt" }));
    expect(value("Protein Hedefi (g)")).toBe("119");
    expect(value("Karbonhidrat (g)")).toBe("159");
    expect(value("Yağ Hedefi (g)")).toBe("43");
    expect(screen.queryByRole("status", { name: "Makro dengesi" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hedefleri Güncelle" }));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "PUT")).toBe(true));
    expect(JSON.parse(String(s.calls.find((c) => c.init?.method === "PUT")!.init?.body))).toMatchObject({
      calorieTarget: 1500,
      proteinTargetG: 119,
      carbTargetG: 159,
      fatTargetG: 43,
    });
  });

  it("makro elle değiştirilince de uyuşmazlık gösterilir; uyarı kaydı engellemez", () => {
    renderWithQuery(<ProfileTargetsSection profile={PROFILE} />);
    fireEvent.change(screen.getByLabelText("Yağ Hedefi (g)"), { target: { value: "90" } });
    expect(screen.getByRole("status", { name: "Makro dengesi" }).textContent).toContain("2.350 kcal");
    expect((screen.getByRole("button", { name: "Hedefleri Güncelle" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("güvenlik tabanı uyarısı dağıtımdan sonra da kalır; onay kutusu işaretlenmeden onay gönderilmez", async () => {
    const s = stubFetch([["/api/profile", () => jsonResponse({ error: "Günlük kalori hedefi 1.200 kcal altında olamaz.", code: "LOW_CALORIE" }, 422)]]);
    restore = s.restore;
    renderWithQuery(<ProfileTargetsSection profile={PROFILE} />);
    fireEvent.change(screen.getByLabelText("Kalori Hedefi (kcal)"), { target: { value: "1100" } });
    fireEvent.click(screen.getByRole("button", { name: "Makroları oranla dağıt" }));
    expect(screen.getByText(/1\.200 kcal altında/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hedefleri Güncelle" }));
    await waitFor(() => expect(s.calls.length).toBe(1));
    expect(JSON.parse(String(s.calls[0].init?.body)).acknowledgeLowCalorie).toBe(false);
  });

  it("profil yoksa hedef alanları ortak varsayılan hedeflerle dolar (kişisel sabit yok)", () => {
    renderWithQuery(<ProfileTargetsSection profile={undefined} />);
    expect(value("Kalori Hedefi (kcal)")).toBe(String(DEFAULT_TARGETS.calorieTarget));
    expect(value("Üst Sınır Tavan (kcal)")).toBe(String(DEFAULT_TARGETS.calorieCeiling));
    expect(value("Protein Hedefi (g)")).toBe(String(DEFAULT_TARGETS.proteinTargetG));
    expect(value("Karbonhidrat (g)")).toBe(String(DEFAULT_TARGETS.carbTargetG));
    expect(value("Yağ Hedefi (g)")).toBe(String(DEFAULT_TARGETS.fatTargetG));
  });
});
