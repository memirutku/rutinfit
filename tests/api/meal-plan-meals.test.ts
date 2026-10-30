import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, PATCH, POST } from "@/app/api/meal-plans/meals/route";
import { POST as copy } from "@/app/api/meal-plans/meals/copy/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood, createRecipe } from "../helpers/factories";

beforeEach(resetDatabase);

const mealsOn = async (date: string) =>
  (await prisma.mealPlan.findUnique({ where: { date }, include: { meals: true } }))?.meals.map((m) => [m.mealType, m.customName ?? m.recipeId, m.servings]) ?? [];

describe("F30: planlı öğün düzenleme", () => {
  it("ekler (gün planı yoksa oluşur), taşır, kopyalar ve siler", async () => {
    const food = await createFood();
    const recipe = await createRecipe([{ foodItemId: food.id, grams: 200 }]);
    const added = await callRoute(POST, { body: { date: "2026-11-02", mealType: "lunch", recipeId: recipe.id, servings: 1.5 } });
    expect(added.status).toBe(201);
    const custom = await callRoute(POST, { body: { date: "2026-11-02", mealType: "dinner", customName: "Diyetisyen: Izgara köfte" } });
    expect(await mealsOn("2026-11-02")).toEqual([
      ["lunch", recipe.id, 1.5],
      ["dinner", "Diyetisyen: Izgara köfte", 1],
    ]);

    await callRoute(PATCH, { method: "PATCH", query: { id: custom.json.id }, body: { date: "2026-11-03", mealType: "lunch" } });
    expect(await mealsOn("2026-11-03")).toEqual([["lunch", "Diyetisyen: Izgara köfte", 1]]);
    expect(await mealsOn("2026-11-02")).toHaveLength(1);

    const copied = await callRoute(copy, { body: { id: added.json.id, toDate: "2026-11-04" } });
    expect(copied.status).toBe(201);
    expect(await mealsOn("2026-11-04")).toEqual([["lunch", recipe.id, 1.5]]);

    expect((await callRoute(DELETE, { method: "DELETE", query: { id: added.json.id } })).status).toBe(200);
    expect(await mealsOn("2026-11-02")).toEqual([]);
  });

  it("tarif ya da ad gerekir; porsiyon 0,25–20; olmayan öğün 404", async () => {
    expect((await callRoute(POST, { body: { date: "2026-11-02", mealType: "lunch" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { date: "2026-11-02", mealType: "lunch", customName: "x", servings: 0 } })).status).toBe(400);
    expect((await callRoute(PATCH, { method: "PATCH", query: { id: "yok" }, body: { servings: 2 } })).status).toBe(404);
    expect((await callRoute(DELETE, { method: "DELETE", query: { id: "yok" } })).status).toBe(404);
  });
});
