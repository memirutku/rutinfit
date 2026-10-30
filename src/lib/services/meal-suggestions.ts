/** B42: model olmadan öğün önerisi için veriyi toplar; sıralama saf fonksiyondadır. */
import { prisma } from "../prisma";
import { getLocalDateString } from "../date-utils";
import { targetsFromProfile } from "../constants";
import { calculateDailySummary, calculateRecipeMacros } from "../nutrition-calculator";
import { rankMealSuggestions, type MealCandidate } from "../meal-suggestions";
import type { MealSuggestions } from "../schemas/chat";

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function suggestMealsWithoutModel(today = getLocalDateString()): Promise<MealSuggestions> {
  const [profile, logs, savedMeals, recipes] = await Promise.all([
    prisma.userProfile.findFirst(),
    prisma.foodLog.findMany({ where: { date: today } }),
    prisma.savedMeal.findMany({ include: { items: true } }),
    prisma.recipe.findMany({ include: { ingredients: { include: { foodItem: true } } } }),
  ]);

  const summary = calculateDailySummary(
    logs.map((l) => ({ calories: l.caloriesSnapshot, proteinG: l.proteinSnapshot, carbsG: l.carbsSnapshot, fatG: l.fatSnapshot })),
    targetsFromProfile(profile)
  );
  const remaining = {
    calories: Math.max(0, summary.remainingCalories),
    proteinG: summary.remainingProtein,
    carbsG: summary.remainingCarbs,
    fatG: summary.remainingFat,
  };

  const candidates: MealCandidate[] = [
    ...savedMeals.map((m) => ({
      id: m.id,
      source: "saved_meal" as const,
      name: m.name,
      calories: Math.round(m.items.reduce((a, i) => a + i.caloriesSnapshot, 0)),
      proteinG: round1(m.items.reduce((a, i) => a + i.proteinSnapshot, 0)),
      carbsG: round1(m.items.reduce((a, i) => a + i.carbsSnapshot, 0)),
      fatG: round1(m.items.reduce((a, i) => a + i.fatSnapshot, 0)),
    })),
    // Tarif tek porsiyon üzerinden önerilir.
    ...recipes.map((r) => {
      const total = calculateRecipeMacros(r.ingredients);
      const servings = r.servings > 0 ? r.servings : 1;
      return {
        id: r.id,
        source: "recipe" as const,
        name: r.name,
        calories: Math.round(total.calories / servings),
        proteinG: round1(total.proteinG / servings),
        carbsG: round1(total.carbsG / servings),
        fatG: round1(total.fatG / servings),
      };
    }),
  ];

  const result = rankMealSuggestions(candidates, remaining);
  return { remaining, ...result };
}
