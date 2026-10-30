import { test, expect, todayStr, uniq } from "./fixtures";

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

  test("B10: bulunamayan satır yaklaşık kaloriyle ya da yeni besin olarak kaydedilir; ekmek eşlenir", async ({ page, api }) => {
    const approx = uniq("zıbıdık tatlısı").toLocaleLowerCase("tr-TR");
    const fresh = uniq("ejder meyvesi").toLocaleLowerCase("tr-TR");
    await page.goto("/");
    await page.getByRole("button", { name: /Yazarak ekle/ }).first().click();
    const d = page.getByRole("dialog", { name: "Yazarak öğün ekle" });
    await d.getByLabel("Ne yedin?").fill(`2 dilim ekmek, 1 dilim ${approx}, 120 g ${fresh}`);
    await d.getByRole("button", { name: "Çözümle" }).click();
    await expect(d.getByLabel("2 dilim ekmek eşleşmesi")).toContainText("Beyaz Ekmek");

    const approxRow = d.getByRole("listitem").filter({ hasText: `1 dilim ${approx}` });
    await approxRow.getByRole("button", { name: "Yaklaşık kalori gir" }).click();
    await approxRow.getByLabel(`1 dilim ${approx} yaklaşık kalori`).fill("250");

    const freshRow = d.getByRole("listitem").filter({ hasText: `120 g ${fresh}` });
    await freshRow.getByRole("button", { name: "Yeni besin olarak ekle" }).click();
    await freshRow.getByLabel("Kalori (kcal/100 g)").fill("60");
    await freshRow.getByRole("button", { name: "Besini kaydet" }).click();
    await expect(freshRow.getByText("72 kcal")).toBeVisible();

    await d.getByRole("button", { name: "3 kalemi kaydet" }).click();
    await expect(d).toBeHidden();
    const logs = await logsToday(api);
    expect(logs.some((l) => l.name === "Beyaz Ekmek" && l.grams === 50)).toBe(true);
    expect(logs.some((l) => l.name.toLocaleLowerCase("tr-TR") === `${approx} (yaklaşık)` && l.caloriesSnapshot === 250 && !l.foodItemId)).toBe(true);
    const created = logs.find((l) => l.name.toLocaleLowerCase("tr-TR") === fresh);
    expect(created?.foodItemId).toBeTruthy();
    expect(created?.caloriesSnapshot).toBe(72);
  });

  test("B11: '1 kase' mercimek çorbası tarif kartında ve yazarak eklemede aynı kaloridir", async ({ page, api }) => {
    const recipes = await (await api.get("/api/recipes")).json();
    const soup = recipes.find((r: { name: string }) => r.name === "Mercimek Çorbası");
    const kcal = Math.round(soup.calculatedMacros.calories / soup.servings);

    await page.goto("/foods");
    await page.getByRole("button", { name: /^Tarifler/ }).click();
    const badge = page.getByLabel(`Porsiyon başına ${kcal} kcal`).first();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("1 kase");

    await page.getByRole("link", { name: "Ana Panel" }).first().click();
    await page.getByRole("button", { name: /Yazarak ekle/ }).first().click();
    const d = page.getByRole("dialog", { name: "Yazarak öğün ekle" });
    await d.getByLabel("Ne yedin?").fill("1 kase mercimek çorbası");
    await d.getByRole("button", { name: "Çözümle" }).click();
    await expect(d.getByRole("listitem").filter({ hasText: "1 kase mercimek çorbası" })).toContainText(`${kcal} kcal`);
  });

  test("B12: whey 'alındı' işaretlenince protein günlüğe yazılır, geri alınınca silinir; kartta ekleme bağlantısı", async ({ page, api }) => {
    const name = uniq("E2E Whey");
    const protein = async () => (await (await api.get(`/api/food-logs?date=${todayStr()}`)).json()).summary.consumedProtein as number;

    await page.goto("/");
    await page.getByRole("link", { name: "+ Takviye / Düzenle" }).click();
    await expect(page).toHaveURL(/\/settings#takviyeler$/);
    const section = page.locator("#takviyeler");
    await section.getByLabel("Takviye adı").fill(name);
    await section.getByLabel("Doz", { exact: true }).fill("30");
    await section.getByLabel("Kalori (doz başına)").fill("120");
    await section.getByLabel("Protein (g, doz başına)").fill("24");
    await section.getByRole("button", { name: "Takviye ekle" }).click();
    await expect(section.getByText(/120 kcal · 24 g protein günlüğe yazılır/)).toBeVisible();

    const before = await protein();
    await page.goto("/");
    const chip = page.locator("button[aria-pressed]").filter({ hasText: name });
    let saved = page.waitForResponse((r) => r.url().endsWith("/api/supplements/log") && r.request().method() === "POST");
    await chip.click();
    expect((await saved).ok()).toBe(true);
    await expect(page.getByText(`${name} (30 g)`)).toBeVisible();
    expect(await protein()).toBeCloseTo(before + 24, 1);

    saved = page.waitForResponse((r) => r.url().endsWith("/api/supplements/log") && r.request().method() === "POST");
    await chip.click();
    expect((await saved).ok()).toBe(true);
    await expect(page.getByText(`${name} (30 g)`)).toBeHidden();
    expect(await protein()).toBeCloseTo(before, 1);
  });
});
