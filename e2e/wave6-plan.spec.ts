import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, uniq } from "./fixtures";

/**
 * Dalga 6, alan C: yemek planı, alışveriş listesi ve diyetisyen raporu (Zeynep'in bulguları).
 * Testler aynı veritabanını paylaşır; her test kendi (rastgele, uzak) gününde çalışır.
 */

/** Paylaşılan veritabanında başka testlerle çakışmayan bir gün (2031–2040). */
function uniqDate(): string {
  const day = new Date(Date.UTC(2031, 0, 1) + Math.floor(Math.random() * 3650) * 86_400_000);
  return day.toISOString().slice(0, 10);
}
const dayLabel = (iso: string) => new RegExp(`${iso.slice(8, 10)}\\.${iso.slice(5, 7)}`);

async function openDay(page: Page, date: string) {
  await page.goto("/nutrition");
  await page.getByLabel("Tarih:").fill(date);
}

async function recipeMeal(api: APIRequestContext, date: string, mealType: string, label: string) {
  const food = await (await api.post("/api/foods", { data: { name: uniq(`${label} besini`), calories: 200, proteinG: 10, carbsG: 30, fatG: 5 } })).json();
  const recipe = await (await api.post("/api/recipes", { data: { name: uniq(label), ingredients: [{ foodItemId: food.id, grams: 200 }] } })).json();
  const res = await api.post("/api/meal-plans/meals", { data: { date, mealType, recipeId: recipe.id, servings: 1 } });
  expect(res.ok()).toBe(true);
  return recipe as { id: string; name: string };
}

test.describe("Dalga 6 · plan, alışveriş ve rapor", () => {
  test("B08: günlük plan haftalık editörde girilen menüyü gösterir; plan yoksa boş durum çıkar", async ({ page, api }) => {
    const date = uniqDate();
    const menu = uniq("2 yumurta, 1 dilim tam buğday ekmeği, 5 zeytin");
    await openDay(page, date);

    // Plan yok: sabit örnek öğün yerine boş durum ve haftalık editöre bağlantı.
    await expect(page.getByText("Bu gün için planlı öğün yok.")).toBeVisible();
    await expect(page.getByText(/Yulaflı Lorlu|Fırın Tavuk Göğsü|Muzlu Yoğurt/)).toHaveCount(0);
    await page.getByRole("link", { name: "Hafta'dan ekle" }).click();

    const day = page.getByRole("region", { name: dayLabel(date) });
    await day.getByRole("button", { name: "+ Öğün" }).click();
    const dialog = page.getByRole("dialog", { name: "Öğün ekle" });
    await dialog.getByLabel("Öğün", { exact: true }).selectOption("breakfast");
    await dialog.getByLabel("Öğün adı").fill(menu);
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await expect(dialog).toBeHidden();

    const lunch = await recipeMeal(api, date, "lunch", "E2E Izgara tavuk");
    await page.getByRole("button", { name: "Yemek Planı", exact: true }).click();

    const breakfast = page.getByRole("article", { name: menu });
    await expect(breakfast).toBeVisible();
    await expect(breakfast).toContainText("Kahvaltı");
    await expect(breakfast).toContainText("Tarife bağlı değil");
    await expect(breakfast).not.toContainText("kcal");

    const lunchCard = page.getByRole("article", { name: lunch.name });
    await expect(lunchCard).toContainText("Öğle Yemeği");
    await expect(lunchCard).toContainText("400 kcal");
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.getByText(/Yulaflı Lorlu|Fırın Tavuk Göğsü|Muzlu Yoğurt/)).toHaveCount(0);
  });
});
