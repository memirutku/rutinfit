import { test, expect, todayStr, uniq } from "./fixtures";

/** Dalga 1 özelliklerinin paketlenmiş sunucuya karşı uçtan uca akışları. */
test.describe("Dalga 1", () => {
  test("F13: su sıvı toplamına eklenir; bira hem içeceğe hem günün öğünlerine yazılır", async ({ page, api }) => {
    const day = async () => (await api.get(`/api/drinks?date=${todayStr()}`)).json();
    const before = (await day()).summary.hydrationMl as number;
    await page.goto("/");
    await page.getByRole("button", { name: "Su bardağı · 200 ml" }).click();
    await expect.poll(async () => (await day()).summary.hydrationMl).toBe(before + 200);
    await page.getByRole("button", { name: "Bira · 33 cl" }).click();
    await expect(page.getByText("Bira (330 ml)").first()).toBeVisible();
  });

  test("F79 + F01: tek tıkla simit; bugünün öğünü adıyla kaydedilir", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "+ Simit" }).click();
    await expect(page.getByText("Simit (1 adet)").first()).toBeVisible();

    await page.getByRole("button", { name: "Kayıtlı öğünler" }).click();
    const dialog = page.getByRole("dialog", { name: "Kayıtlı öğünler" });
    const name = uniq("E2E Sabah");
    await dialog.getByLabel("Ad").fill(name);
    await dialog.getByRole("button", { name: "Öğünü kaydet" }).click();
    await expect(dialog.getByText(name, { exact: true })).toBeVisible();
  });

  test("F67 + F60: şeffaflık paneli görünür; CSV dosyası iner", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /Hesap yok, bulut yok/ })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Kilo ve bel ölçüsü (CSV)" }).click();
    expect((await download).suggestedFilename()).toMatch(/^rutinfit-vucut-olculeri-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test("F20 + F23 + F24: set RPE'li antrenman ilerleme sayfasında rekor ve hacim olarak görünür", async ({ page, api }) => {
    const res = await api.post("/api/workouts", {
      data: {
        date: todayStr(),
        name: uniq("E2E Güç"),
        durationMinutes: 30,
        setLogs: [{ exerciseName: "Bench Press", setNumber: 1, weightKg: 60, reps: 5, rpe: 8.5 }],
      },
    });
    expect(res.status()).toBe(201);
    await page.goto("/progress");
    await expect(page.getByRole("heading", { name: "Güç gelişimi" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Haftalık set hacmi" })).toBeVisible();
    await expect(page.getByRole("row", { name: /Göğüs/ })).toBeVisible();
  });
});
