import { test, expect, todayStr } from "./fixtures";

/**
 * Dalga 6 · B alanı (besin kaydı ve katalog). E2E sunucusu seed çalıştırır; başlangıç kataloğunun
 * boş veritabanındaki davranışı Vitest'te (tests/api/starter-catalog.test.ts) sınanır. Burada
 * açılışta kurulan kataloğun kullanıcı akışlarında işe yaradığı doğrulanır.
 */

const logsToday = async (api: import("@playwright/test").APIRequestContext) =>
  (await (await api.get(`/api/food-logs?date=${todayStr()}`)).json()).logs as Array<Record<string, any>>;

test.describe("Dalga 6 · besin", () => {
  test("B01: açılışta kurulan katalogla hızlı eklemede mercimek çorbası porsiyonla kaydedilir", async ({ page, api }) => {
    const status = await (await api.get("/api/catalog/starter")).json();
    expect(status.foods).toBeGreaterThan(20);
    const recipes = await (await api.get("/api/recipes")).json();
    expect(recipes.some((r: { name: string }) => r.name === "Mercimek Çorbası")).toBe(true);

    await page.goto("/");
    await page.getByRole("button", { name: "Hızlı Öğün Ekle" }).click();
    const d = page.getByRole("dialog", { name: "Hızlı Öğün Kaydı" });
    await expect(d.getByRole("option", { name: /Mercimek Çorbası/ })).toBeAttached();
    await d.getByRole("searchbox", { name: "Besin ara" }).fill("mercimek");
    await expect(d.getByLabel("Besin Seçin")).toHaveValue(/^recipe:/);
    await expect(d.getByLabel("Birim")).toHaveValue("porsiyon");
    await d.getByRole("button", { name: "Ekle" }).click();
    await expect(d).toBeHidden();
    const logs = await logsToday(api);
    expect(logs.some((l) => l.name === "Mercimek Çorbası" && l.recipeId && l.caloriesSnapshot > 0)).toBe(true);
  });

  test("B01: panodaki 'Yeni besin ekle' bağlantısı besin formunu açık getirir", async ({ page }) => {
    await page.goto("/foods?yeni=1");
    await expect(page.getByRole("dialog", { name: "Yeni Besin Ekle" })).toBeVisible();
  });
});
