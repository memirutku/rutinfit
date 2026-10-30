import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/ai/meal-suggestions/route";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/date-utils";
import { MealSuggestionsSchema } from "@/lib/schemas/chat";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood, createProfile } from "../helpers/factories";

beforeEach(resetDatabase);

describe("GET /api/ai/meal-suggestions (B42)", () => {
  it("bugün kalan kalori ve makroya göre kayıtlı öğün ve tariflerden ilk 3'ü döner", async () => {
    await createProfile({ calorieTarget: 2000, proteinTargetG: 120, carbTargetG: 220, fatTargetG: 60 });
    await prisma.foodLog.create({
      data: { date: getLocalDateString(), time: "08:00", mealType: "breakfast", name: "Kahvaltı", grams: 300, caloriesSnapshot: 1300, proteinSnapshot: 60, carbsSnapshot: 140, fatSnapshot: 40 },
    });
    await prisma.savedMeal.create({
      data: {
        name: "Tavuk ve pilav",
        items: {
          create: [
            { name: "Tavuk", grams: 150, caloriesSnapshot: 250, proteinSnapshot: 45, carbsSnapshot: 0, fatSnapshot: 6, orderIndex: 0 },
            { name: "Pilav", grams: 150, caloriesSnapshot: 200, proteinSnapshot: 4, carbsSnapshot: 44, fatSnapshot: 1, orderIndex: 1 },
          ],
        },
      },
    });
    await prisma.savedMeal.create({
      data: { name: "Çok büyük tabak", items: { create: [{ name: "X", grams: 500, caloriesSnapshot: 1200, proteinSnapshot: 50, carbsSnapshot: 100, fatSnapshot: 60 }] } },
    });
    const lentil = await createFood({ name: "Kırmızı Mercimek", calories: 340, proteinG: 24, carbsG: 50, fatG: 1.5 });
    await prisma.recipe.create({
      data: { name: "Mercimek çorbası", servings: 2, ingredients: { create: [{ foodItemId: lentil.id, grams: 200 }] } },
    });
    await prisma.recipe.create({ data: { name: "Boş tarif", servings: 1 } });

    const res = await callRoute(GET);
    expect(res.status).toBe(200);
    const body = MealSuggestionsSchema.parse(res.json);
    expect(body.remaining).toMatchObject({ calories: 700, proteinG: 60 });
    expect(body.suggestions.map((s) => s.name)).toEqual(["Tavuk ve pilav", "Mercimek çorbası"]);
    expect(body.suggestions[0]).toMatchObject({ source: "saved_meal", calories: 450, proteinG: 49 });
    // Tarif tek porsiyon üzerinden: 200 g mercimek / 2 porsiyon.
    expect(body.suggestions[1]).toMatchObject({ source: "recipe", calories: 340, proteinG: 24 });
  });

  it("kayıtlı öğün ya da tarif yoksa nedeni döner", async () => {
    await createProfile({ calorieTarget: 2000 });
    const body = MealSuggestionsSchema.parse((await callRoute(GET)).json);
    expect(body).toMatchObject({ suggestions: [], reason: "no_candidates" });
  });
});
