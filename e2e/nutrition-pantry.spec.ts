import { test, expect, todayStr, uniq } from "./fixtures";
import type { APIRequestContext } from "@playwright/test";

async function planRecipeToday(api: APIRequestContext, ingredientName: string, grams: number, mealType = "breakfast") {
  const food = await (
    await api.post("/api/foods", { data: { name: ingredientName, calories: 200, proteinG: 10, carbsG: 30, fatG: 5, category: "Kuru Gıda & Tahıllar" } })
  ).json();
  const recipe = await (
    await api.post("/api/recipes", { data: { name: `${ingredientName} Kasesi`, ingredients: [{ foodItemId: food.id, grams }] } })
  ).json();
  const plan = await api.post("/api/meal-plans", {
    data: { date: todayStr(), meals: [{ mealType, recipeId: recipe.id, servings: 1 }] },
  });
  expect(plan.ok()).toBe(true);
  return { food, recipe };
}

test.describe("Beslenme planı, kiler ve alışveriş listesi", () => {
  test("kilerde 500 g varken plan 800 g isterse listede yalnız 300 g eksik görünür", async ({ page, api }) => {
    const name = uniq("E2E Yulaf");
    await planRecipeToday(api, name, 800);
    await api.post("/api/pantry", { data: { name, amount: 500, unit: "g" } });
    await api.post("/api/shopping", { data: { weekStart: todayStr(), deductPantry: true } });

    await page.goto("/nutrition");
    await page.getByRole("button", { name: /Alışveriş/ }).first().click();
    const item = page.getByRole("checkbox", { name: new RegExp(name) });
    await expect(item).toBeVisible();
    await expect(item).toContainText("300 g");
  });

  test("'Yedim' 1.5x porsiyon ekranda gösterilen kaloriyle aynı değeri kaydeder", async ({ page, api }) => {
    const name = uniq("E2E Bulgur");
    await planRecipeToday(api, name, 200); // 400 kcal
    await page.goto("/nutrition");

    const card = page.locator("div", { has: page.getByRole("heading", { name: `${name} Kasesi` }) }).last();
    await card.getByRole("button", { name: "1.5x" }).click();
    await expect(card).toContainText("600 kcal");
    await card.getByRole("button", { name: "1.5x Porsiyon Olarak Kaydet" }).click();
    await expect(page.getByText(/günlüğe kaydedildi/)).toBeVisible();

    const logs = (await (await api.get(`/api/food-logs?date=${todayStr()}`)).json()).logs;
    const log = logs.find((l: any) => l.name === `${name} Kasesi`);
    expect(log).toMatchObject({ caloriesSnapshot: 600, grams: 300 });
  });

  test("kilerde +/- son kullanma tarihini ve notu silmez", async ({ page, api }) => {
    const name = uniq("E2E Süt");
    const { item } = await (
      await api.post("/api/pantry", { data: { name, amount: 1, unit: "l", expiryDate: "2030-01-01", notes: "laktozsuz" } })
    ).json();

    await page.goto("/pantry");
    await page.getByRole("button", { name: `${name} miktarını artır` }).click();
    await expect(page.getByText("1,1 l").first()).toBeVisible();

    const after = (await (await api.get("/api/pantry")).json()).items.find((i: any) => i.id === item.id);
    expect(after).toMatchObject({ amount: 1.1, expiryDate: "2030-01-01", notes: "laktozsuz" });
  });
});

test("kilerden silme uygulama içi onayla yapılır; Vazgeç silmez", async ({ page, api }) => {
  const name = uniq("E2E Silinecek");
  await api.post("/api/pantry", { data: { name, amount: 1, unit: "adet" } });
  await page.goto("/pantry");

  await page.getByRole("button", { name: `${name} öğesini sil` }).click();
  const dialog = page.getByRole("dialog", { name: "Malzemeyi sil" });
  await dialog.getByRole("button", { name: "Vazgeç" }).click();
  await expect(page.getByText(name)).toBeVisible();

  await page.getByRole("button", { name: `${name} öğesini sil` }).click();
  await page.getByRole("dialog", { name: "Malzemeyi sil" }).getByRole("button", { name: "Sil" }).click();
  await expect(page.getByText(name)).toHaveCount(0);
  const items = (await (await api.get("/api/pantry")).json()).items;
  expect(items.some((i: any) => i.name === name)).toBe(false);
});
