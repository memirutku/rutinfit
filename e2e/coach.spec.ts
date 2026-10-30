import { test, expect, actionBlock, todayStr, uniq } from "./fixtures";

const mealProposal = (title: string) => ({
  type: "meal_proposal",
  mealType: "dinner",
  title,
  rationale: "Protein açığını kapatır",
  prepMinutes: 20,
  ingredients: [{ foodName: "Tavuk Göğsü", grams: 150 }],
  estimatedMacros: { calories: 999, proteinG: 99, carbsG: 9, fatG: 9 },
});

async function ask(page: import("@playwright/test").Page, text: string) {
  await page.getByPlaceholder(/Sorunuzu yazın/).fill(text);
  await page.getByRole("button", { name: /Gönder/ }).click();
}

test.describe("AI koçu (sahte LLM)", () => {
  test("öğün önerisi onaylanınca bugünün planına bir kez eklenir (çift tık dahil)", async ({ page, api, mocks }) => {
    const title = uniq("E2E Tavuklu Tabak");
    await mocks.queueLLM(actionBlock("Akşam için önerim:", mealProposal(title)));
    await page.goto("/coach");
    await ask(page, "Akşam ne yiyeyim?");

    const approve = page.getByRole("button", { name: "Onayla ve Plana Ekle" });
    await expect(approve).toBeVisible();
    await approve.dblclick();
    await expect(page.getByText("Plana Eklendi ✓")).toBeVisible();

    const plans = await (await api.get(`/api/meal-plans?date=${todayStr()}`)).json();
    const matches = (plans[0]?.meals ?? []).filter((m: any) => m.customName === title);
    expect(matches).toHaveLength(1);
    const logs = (await (await api.get(`/api/food-logs?date=${todayStr()}`)).json()).logs;
    expect(logs.some((l: any) => l.name === title)).toBe(false);
  });

  test("kart modelin tahminini değil katalogdan hesaplanan kaloriyi gösterir", async ({ page, mocks }) => {
    await mocks.queueLLM(actionBlock("Öneri:", mealProposal(uniq("E2E Kart"))));
    await page.goto("/coach");
    await ask(page, "öneri");
    await expect(page.getByRole("button", { name: "Onayla ve Plana Ekle" })).toBeVisible();
    await expect(page.getByText("999 kcal")).toHaveCount(0);
  });

  test("öneri reddedilince iptal bildirimi görünür", async ({ page, mocks }) => {
    await mocks.queueLLM(actionBlock("Öneri:", mealProposal(uniq("E2E Red"))));
    await page.goto("/coach");
    await ask(page, "öneri");
    await page.getByRole("button", { name: "Vazgeç" }).click();
    await expect(page.getByText("Bu öneri taslağı kullanıcı tarafından iptal edildi.")).toBeVisible();
  });

  test("model sunucusu hata verirse anlaşılır mesaj gösterilir", async ({ page, mocks }) => {
    await mocks.queueLLMError(500);
    await page.goto("/coach");
    await ask(page, "selam");
    await expect(page.getByText(/hata verdi \(500\)/)).toBeVisible();
  });
});
