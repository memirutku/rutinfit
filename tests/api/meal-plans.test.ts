import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/meal-plans/route";
import { GET as adherenceGet, PATCH as adherencePatch } from "@/app/api/meal-plans/adherence/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood, createMealPlan, createRecipe } from "../helpers/factories";

beforeEach(resetDatabase);

describe("GET /api/meal-plans", () => {
  it("4 porsiyonluk tariften 1 porsiyonun makrosu toplamın dörtte biridir", async () => {
    const food = await createFood({ calories: 200, proteinG: 20, carbsG: 10, fatG: 8 });
    const recipe = await createRecipe([{ foodItemId: food.id, grams: 400 }], { servings: 4 }); // toplam 800 kcal
    await createMealPlan("2026-10-19", [{ mealType: "dinner", recipeId: recipe.id, servings: 1 }]);

    const res = await callRoute(GET, { query: { date: "2026-10-19" } });
    expect(res.status).toBe(200);
    expect(res.json[0].meals[0].calculatedMacros).toEqual({ calories: 200, proteinG: 20, carbsG: 10, fatG: 8 });
  });
});

describe("F78: /api/meal-plans/adherence", () => {
  it("öğün işaretlenir (uygulandı/kısmen tamamlandı sayılır); işaret kaldırılabilir", async () => {
    const plan = await createMealPlan("2026-10-19", [{ mealType: "lunch", customName: "Diyetisyen: Izgara köfte" }]);
    const id = plan.meals[0].id;
    const res = await callRoute(adherencePatch, { method: "PATCH", body: { plannedMealId: id, adherence: "partial" } });
    expect(res.status).toBe(200);
    expect(await prisma.plannedMeal.findUniqueOrThrow({ where: { id } })).toMatchObject({ adherence: "partial", isCompleted: true });
    await callRoute(adherencePatch, { method: "PATCH", body: { plannedMealId: id, adherence: "skipped" } });
    expect(await prisma.plannedMeal.findUniqueOrThrow({ where: { id } })).toMatchObject({ adherence: "skipped", isCompleted: false });
    await callRoute(adherencePatch, { method: "PATCH", body: { plannedMealId: id, adherence: null } });
    expect((await prisma.plannedMeal.findUniqueOrThrow({ where: { id } })).adherence).toBeNull();
  });

  it("tarih aralığı için uyum özeti; geçersiz değer 400, olmayan öğün 404", async () => {
    const a = await createMealPlan("2026-10-19", [{ mealType: "breakfast", customName: "A" }, { mealType: "lunch", customName: "B" }]);
    const b = await createMealPlan("2026-10-21", [{ mealType: "dinner", customName: "C" }]);
    await prisma.plannedMeal.update({ where: { id: a.meals[0].id }, data: { adherence: "done" } });
    await prisma.plannedMeal.update({ where: { id: a.meals[1].id }, data: { adherence: "partial" } });
    await prisma.plannedMeal.update({ where: { id: b.meals[0].id }, data: { adherence: "done" } });
    const res = await callRoute(adherenceGet, { query: { from: "2026-10-19", to: "2026-10-25" } });
    expect(res.json).toMatchObject({ planned: 3, marked: 3, done: 2, partial: 1, percent: 83 });
    expect((await callRoute(adherenceGet, { query: { from: "2026-10-20", to: "2026-10-20" } })).json.planned).toBe(0);

    expect((await callRoute(adherencePatch, { method: "PATCH", body: { plannedMealId: a.meals[0].id, adherence: "belki" } })).status).toBe(400);
    expect((await callRoute(adherencePatch, { method: "PATCH", body: { plannedMealId: "yok", adherence: "done" } })).status).toBe(404);
  });
});
