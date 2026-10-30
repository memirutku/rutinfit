import { test, expect } from "./fixtures";

test.describe("Antrenman", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workouts");
    await page.evaluate(() => localStorage.removeItem("rutinfit_active_workout_draft"));
    await page.reload();
  });

  test("set tamamlanınca dinlenme sayacı başlar; yenilemede kaldığı yerden devam edilir", async ({ page }) => {
    await page.getByRole("button", { name: /^Başla \(/ }).first().click();
    await page.getByRole("button", { name: "Tamamla" }).first().click();
    await expect(page.getByText("Süre akıyor...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sayacı duraklat" })).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Kaldığın Yerden Devam Et" }).click();
    await expect(page.getByRole("button", { name: "Tamamlandı" }).first()).toBeVisible();
  });

  test("kayıt 400 dönerse seans ve taslak korunur, hata gösterilir", async ({ page }) => {
    await page.getByRole("button", { name: /^Başla \(/ }).first().click();
    await page.route("**/api/workouts", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Geçersiz veri — weightKg" }) })
        : route.continue()
    );
    await page.getByRole("button", { name: "Antrenmanı Bitir & Kaydet" }).click();
    // B17: hiç set tamamlanmadıysa önce sorulur; "tamamlandı say" ile kayda gider.
    await page.getByRole("button", { name: "Tamamlandı say ve kaydet" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "verileriniz korunuyor" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Antrenmanı Bitir & Kaydet" })).toBeVisible();
    const draft = await page.evaluate(() => localStorage.getItem("rutinfit_active_workout_draft"));
    expect(draft).not.toBeNull();
  });

  test("başarılı kayıtta ilerleme analizi gösterilir", async ({ page }) => {
    await page.getByRole("button", { name: /^Başla \(/ }).first().click();
    await page.getByLabel("Ağırlık:").first().fill("50");
    await page.getByRole("button", { name: "Tamamla" }).first().click();
    await page.getByRole("button", { name: "Antrenmanı Bitir & Kaydet" }).click();
    // B17: tamamlanmayan setler için karar sorulur.
    await page.getByRole("button", { name: "At ve kaydet" }).click();
    await expect(page.getByText(/Seans Tamamlandı/)).toBeVisible();
  });
});
