import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/meal-plans/route";
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
