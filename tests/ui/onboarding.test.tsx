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

const PROGRAMS = [
  { id: "tam-vucut-baslangic", name: "Tam vücut başlangıç", description: "Yeni başlayanlar", place: "Spor salonu", daysPerWeek: 3, days: [] },
  { id: "ev-dambil", name: "Evde dambılla", description: "Ev", place: "Ev", daysPerWeek: 3, days: [] },
];

function stubWizard() {
  const s = stubFetch([
    ["/api/profile", (_u, init) => jsonResponse({ ...PROFILE, ...JSON.parse(String(init?.body ?? "{}")) })],
    ["/api/fasting/settings", (_u, init) => jsonResponse(JSON.parse(String(init?.body ?? "{}")))],
    ["/api/workouts/programs", (_u, init) => (init?.method === "POST" ? jsonResponse({ created: 3 }) : jsonResponse(PROGRAMS))],
  ]);
  restore = s.restore;
  return s;
}

const bodyOf = (s: ReturnType<typeof stubWizard>, path: string, method: string) =>
  JSON.parse(String(s.calls.find((c) => c.url.includes(path) && c.init?.method === method)?.init?.body ?? "null"));

describe("F09: kurulum sihirbazı", () => {
  it("beş adımda hedefi hesaplar, başlarken seçimlerini ve profili kaydeder", async () => {
    const s = stubWizard();
    const onClose = vi.fn();
    renderWithQuery(<SetupWizard open profile={PROFILE} onClose={onClose} />);

    // 1. Vücut: kurulmamış profilde şema varsayılanları gösterilmez; B05: cinsiyet seçili gelmez, hata erken çıkmaz.
    expect((screen.getByLabelText("Boy (cm)") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Kilo (kg)") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Cinsiyet") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(screen.getByLabelText("Cinsiyet"), { target: { value: "male" } });
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
    // 4. B06: Başlarken — gün düzeni, oruç, başlangıç programı
    expect(screen.queryByLabelText("Eve varış saati")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Ofis / iş yeri" }));
    fireEvent.change(screen.getByLabelText("Eve varış saati"), { target: { value: "18:45" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Ramazan'da oruç tutuyorum/ }));
    fireEvent.change(screen.getByLabelText("İl"), { target: { value: "Ankara" } });
    fireEvent.click(await screen.findByRole("radio", { name: /Tam vücut başlangıç/ }));
    next();
    // 5. Özet
    expect(screen.getByText("2.930 kcal")).toBeTruthy();
    expect(screen.getByText(/2\.380 kcal/)).toBeTruthy();
    expect(screen.getByText(/03\.09\.2027/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Kaydet ve başla" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodyOf(s, "/api/profile", "PUT")).toMatchObject({
      sex: "male",
      calorieTarget: 2380,
      calorieCeiling: 2480,
      proteinTargetG: 162,
      activityLevel: "light",
      goalType: "lose",
      goalRateKgPerWeek: 0.5,
      targetWeightKg: 90,
      wakeTime: "06:30",
      dayPattern: "office",
      workdayHomeTime: "18:45",
      isOnboarded: true,
    });
    expect(bodyOf(s, "/api/fasting/settings", "PUT")).toEqual({ ramadanMode: true, ramadanProvince: "Ankara" });
    expect(bodyOf(s, "/api/workouts/programs", "POST")).toEqual({ programId: "tam-vucut-baslangic", mode: "add" });
  });

  it("B06: başlarken adımı boş geçilirse gün düzeni girilmemiş kalır, oruç ve program kaydedilmez", async () => {
    const s = stubWizard();
    const onClose = vi.fn();
    renderWithQuery(<SetupWizard open profile={PROFILE} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Cinsiyet"), { target: { value: "female" } });
    fillBody("22", "165", "60");
    next();
    next();
    fireEvent.click(screen.getByRole("radio", { name: "Kiloyu koru" }));
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Kaydet ve başla" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodyOf(s, "/api/profile", "PUT")).toMatchObject({ sex: "female", dayPattern: null });
    expect(s.calls.some((c) => c.url.includes("/api/fasting/settings"))).toBe(false);
    expect(s.calls.some((c) => c.url.includes("/api/workouts/programs") && c.init?.method === "POST")).toBe(false);
  });

  it("kurulmuş profilde sihirbaz mevcut ölçülerle açılır", () => {
    restore = stubFetch([["/api/profile", () => jsonResponse(PROFILE)]]).restore;
    renderWithQuery(<SetupWizard open profile={{ ...PROFILE, isOnboarded: true }} onClose={vi.fn()} />);
    expect((screen.getByLabelText("Boy (cm)") as HTMLInputElement).value).toBe("181");
    expect((screen.getByLabelText("Kilo (kg)") as HTMLInputElement).value).toBe("112");
    expect((screen.getByLabelText("Cinsiyet") as HTMLSelectElement).value).toBe("male");
  });

  it("B05: hata alandan çıkınca o alan için görünür; geçersiz değerde 'İleri' ilerlemez ve tüm hataları gösterir", () => {
    const s = stubFetch([["/api/profile", () => jsonResponse(PROFILE)]]);
    restore = s.restore;
    const onClose = vi.fn();
    renderWithQuery(<SetupWizard open profile={PROFILE} onClose={onClose} />);
    // Boş alandan çıkmak hata göstermez (ör. "Şimdilik geç"e basarken).
    fireEvent.blur(screen.getByLabelText("Cinsiyet"));
    fireEvent.blur(screen.getByLabelText("Boy (cm)"));
    expect(screen.queryByRole("alert")).toBeNull();
    const age = screen.getByLabelText("Yaş");
    fireEvent.change(age, { target: { value: "5" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(age);
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual(["Yaş 13 ile 100 arasında olmalı."]);

    fillBody("25", "181", "8");
    next();
    expect(screen.getByRole("dialog", { name: /Hedeflerini birlikte kuralım/ }).textContent).toContain("Adım 1 / 5");
    const messages = screen.getAllByRole("alert").map((a) => a.textContent);
    expect(messages).toEqual(expect.arrayContaining(["Cinsiyetini seç.", "Kilo 30 ile 350 kg arasında olmalı."]));
    fireEvent.click(screen.getByRole("button", { name: "Şimdilik geç" }));
    expect(onClose).toHaveBeenCalled();
    expect(s.calls.filter((c) => c.init?.method === "PUT")).toHaveLength(0);
  });

  it("'Kiloyu koru' seçilince hedef kilo ve hız sorulmaz; hedef günlük harcama olur", () => {
    stubWizard();
    renderWithQuery(<SetupWizard open profile={PROFILE} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Cinsiyet"), { target: { value: "male" } });
    fillBody();
    next();
    fireEvent.click(screen.getByRole("radio", { name: /Hafif hareketli/ }));
    next();
    fireEvent.click(screen.getByRole("radio", { name: "Kiloyu koru" }));
    expect(screen.queryByLabelText("Hedef kilo (kg)")).toBeNull();
    next();
    next();
    expect(screen.getAllByText(/2\.930 kcal/).length).toBeGreaterThanOrEqual(2);
  });
});
