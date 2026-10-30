import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures";

/**
 * Dalga 6, A alanı: ilk kurulum, pano ve gezinme (persona bulguları B02, B05, B06, B07, B26, B32).
 * Profil değiştiren testler sonunda eski profili geri yükler (testler aynı veritabanını paylaşır).
 */

const PROFILE_KEYS = [
  "heightCm", "age", "sex", "currentWeightKg", "calorieTarget", "calorieCeiling", "proteinTargetG", "fatTargetG", "carbTargetG",
  "wakeTime", "workdayHomeTime", "isOnboarded", "hideNumbers", "activityLevel", "goalType", "goalRateKgPerWeek", "targetWeightKg", "dayPattern",
] as const;

async function snapshotProfile(api: APIRequestContext) {
  const p = await (await api.get("/api/profile")).json();
  return Object.fromEntries(PROFILE_KEYS.map((k) => [k, p[k]]));
}

async function putProfile(api: APIRequestContext, body: Record<string, unknown>) {
  const res = await api.put("/api/profile", { data: { ...body, acknowledgeLowCalorie: true } });
  expect(res.ok()).toBe(true);
}

test.describe("Dalga 6 · pano ve ilk kurulum", () => {
  test("B32: dar pencerede 'Daha fazla' menüsünden Ayarlar ve İlerleme açılır", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const bottom = page.getByRole("navigation", { name: "Alt menü" });
    await bottom.getByRole("button", { name: "Daha fazla" }).click();
    await page.getByRole("dialog", { name: "Diğer sayfalar" }).getByRole("link", { name: "Ayarlar" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await bottom.getByRole("button", { name: "Daha fazla" }).click();
    await page.getByRole("dialog", { name: "Diğer sayfalar" }).getByRole("link", { name: "İlerleme" }).click();
    await expect(page).toHaveURL(/\/progress$/);
  });

  test("B02 + B05 + B06: atlanan sihirbaz tahmini hedef şeridi bırakır; başlarken adımı gün düzenini kaydeder", async ({ page, api }) => {
    const original = await snapshotProfile(api);
    try {
      await putProfile(api, { ...original, isOnboarded: false, dayPattern: null });
      await page.goto("/");
      const wizard = page.getByRole("dialog", { name: "Hedeflerini birlikte kuralım" });
      await expect(wizard).toBeVisible();
      await wizard.getByRole("button", { name: "Şimdilik geç" }).click();

      await expect(page.getByText("Hedeflerin tahmini.")).toBeVisible();
      await expect(page.getByText("Tahmini hedef")).toBeVisible();
      await expect(page.getByText(/Eve tahmini varış/)).toHaveCount(0);

      await page.getByRole("button", { name: "Profilini tamamla" }).click();
      // B05: cinsiyet seçili gelmez; boş "İleri" hataları gösterir ve ilerlemez.
      await expect(wizard.getByLabel("Cinsiyet")).toHaveValue("");
      await expect(wizard.getByRole("alert")).toHaveCount(0);
      await wizard.getByRole("button", { name: "İleri" }).click();
      await expect(wizard.getByText("Cinsiyetini seç.")).toBeVisible();
      await expect(wizard.getByText(/Adım 1 \/ 5/)).toBeVisible();

      await wizard.getByLabel("Cinsiyet").selectOption({ label: "Kadın" });
      await wizard.getByLabel("Yaş").fill("22");
      await wizard.getByLabel("Boy (cm)").fill("165");
      await wizard.getByLabel("Kilo (kg)").fill("60");
      await wizard.getByRole("button", { name: "İleri" }).click();
      await wizard.getByRole("button", { name: "İleri" }).click();
      await wizard.getByLabel("Kiloyu koru").check({ force: true });
      await wizard.getByRole("button", { name: "İleri" }).click();
      // B06: başlarken
      await wizard.getByRole("radio", { name: "Okul" }).check();
      await wizard.getByLabel("Eve varış saati").fill("16:30");
      await wizard.getByRole("button", { name: "İleri" }).click();
      await wizard.getByRole("button", { name: "Kaydet ve başla" }).click();
      await expect(wizard).toBeHidden();

      await expect(page.getByText("Hedeflerin tahmini.")).toHaveCount(0);
      await expect(page.getByText(/Eve tahmini varış: 16:30/)).toBeVisible();
      const saved = await (await api.get("/api/profile")).json();
      expect(saved).toMatchObject({ sex: "female", dayPattern: "school", workdayHomeTime: "16:30", isOnboarded: true });
    } finally {
      await putProfile(api, original);
    }
  });

  test("B07: hedef kilo girilince panoda 'Kilo hedefim' kartı görünür", async ({ page, api }) => {
    const original = await snapshotProfile(api);
    try {
      await putProfile(api, { ...original, isOnboarded: true, goalType: "lose", goalRateKgPerWeek: 0.5, currentWeightKg: 95, targetWeightKg: 80 });
      await page.goto("/");
      const card = page.getByRole("region", { name: "Kilo hedefim" });
      await expect(card).toBeVisible();
      await expect(card).toContainText("Hedef 80 kg");
      await expect(card).toContainText("kaldı");
    } finally {
      await putProfile(api, original);
    }
  });

  test("B26: Ramazan modu açıkken Ramazan dışındaysa kalan gün gösterilir", async ({ page, api }) => {
    const before = await (await api.get("/api/fasting")).json();
    const status = await (await api.put("/api/fasting/settings", { data: { ramadanMode: true, ramadanProvince: "İstanbul" } })).json();
    try {
      expect(status.ramadanMode).toBe(true);
      const now = await (await api.get("/api/fasting")).json();
      await page.goto("/");
      if (now.ramadan.period?.inRamadan) {
        await expect(page.getByText(/İftara|İmsaka|Yarın imsaka/).first()).toBeVisible();
      } else {
        await expect(page.getByText(`Ramazan'a ${now.ramadan.period.daysUntil} gün`)).toBeVisible();
        await expect(page.getByText(/^İftara /)).toHaveCount(0);
      }
    } finally {
      await api.put("/api/fasting/settings", { data: { ramadanMode: before.ramadan !== null } });
    }
  });
});
