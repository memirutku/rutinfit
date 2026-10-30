import { test, expect, todayStr } from "./fixtures";

const logCount = async (api: import("@playwright/test").APIRequestContext) =>
  (await (await api.get(`/api/food-logs?date=${todayStr()}`)).json()).logs.length as number;

test.describe("Ana panel", () => {
  test("hızlı öğün eklenir ve 'Geri Al' ile kaldırılır", async ({ page, api }) => {
    await page.goto("/");
    const before = await logCount(api);

    await page.getByRole("button", { name: "Hızlı Öğün Ekle" }).click();
    const dialog = page.getByRole("dialog", { name: "Hızlı Öğün Kaydı" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Miktar (Gram)").fill("150");
    await dialog.getByRole("button", { name: "Ekle" }).click();

    await expect(dialog).toBeHidden();
    const toast = page.getByRole("status").filter({ hasText: "başarıyla eklendi" });
    await expect(toast).toBeVisible();
    await expect.poll(() => logCount(api)).toBe(before + 1);

    await toast.getByRole("button", { name: "Geri Al" }).click();
    await expect.poll(() => logCount(api)).toBe(before);
  });

  test("silinen öğün 'Geri Al' ile aynı makrolarla geri gelir", async ({ page, api }) => {
    const foods = await (await api.get("/api/foods?limit=1")).json();
    const created = await (
      await api.post("/api/food-logs", {
        data: { date: todayStr(), mealType: "extra", foodItemId: foods[0].id, name: foods[0].name, grams: 123 },
      })
    ).json();

    await page.goto("/");
    await page.getByRole("button", { name: `${created.name} öğününü sil` }).first().click();
    const toast = page.getByRole("status").filter({ hasText: "kaldırıldı" });
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Geri Al" }).click();

    await expect
      .poll(async () => {
        const logs = (await (await api.get(`/api/food-logs?date=${todayStr()}`)).json()).logs;
        return logs.some((l: any) => l.grams === 123 && l.caloriesSnapshot === created.caloriesSnapshot && l.id !== created.id);
      })
      .toBe(true);
  });

  test("geri alma bildirimi 7 saniye sonra kendiliğinden kapanır", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    await page.getByRole("button", { name: "Hızlı Öğün Ekle" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ekle" }).click();
    const toast = page.getByRole("status").filter({ hasText: "başarıyla eklendi" });
    await expect(toast).toBeVisible();
    await page.clock.runFor(7_500);
    await expect(toast).toBeHidden();
  });

  test("kreatin işareti sayfa yenilense de korunur", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "5g Kreatin Alındı" });
    const initial = await toggle.getAttribute("aria-pressed");
    // İşaret iyimserdir (anında değişir); yenilemeden önce kaydın sunucuya ulaşması beklenir.
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/progress") && r.request().method() === "POST");
    await toggle.click();
    const expected = initial === "true" ? "false" : "true";
    await expect(toggle).toHaveAttribute("aria-pressed", expected);
    expect((await saved).ok()).toBe(true);
    await page.reload();
    await expect(page.getByRole("button", { name: "5g Kreatin Alındı" })).toHaveAttribute("aria-pressed", expected);
  });

  test("kayıt sunucuda başarısız olursa başarı değil hata gösterilir", async ({ page }) => {
    await page.goto("/");
    await page.route("**/api/progress", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Disk dolu" }) })
        : route.continue()
    );
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Disk dolu" })).toBeVisible();
    await expect(page.getByText("Kayıt güncellendi ✓")).toHaveCount(0);
  });
});
