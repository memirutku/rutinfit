/**
 * F01: Kayıtlı öğünler ve öğün/gün kopyalama.
 * - Kaydetme: günün o öğünündeki kayıtlar kalem olarak saklanır.
 * - Ekleme: katalog gıdası güncel 100 g değerinden, tarif güncel malzemelerinden, serbest
 *   kalem kayıtlı değerinden hesaplanır.
 * - Kopyalama: kayıtlar olduğu gibi (kayıtlı değerleriyle) çoğaltılır.
 */
import { prisma } from "../prisma";
import { HttpError } from "../api-error";
import { getLocalTimeString } from "../date-utils";
import { calculatePortionMacros, calculateRecipeMacros, scaleMacros } from "../nutrition-calculator";
import type { MealType } from "../schemas/enums";

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function listSavedMeals() {
  const meals = await prisma.savedMeal.findMany({
    include: { items: { orderBy: { orderIndex: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return meals.map((m) => ({
    id: m.id,
    name: m.name,
    mealType: m.mealType,
    itemCount: m.items.length,
    totalCalories: Math.round(m.items.reduce((a, i) => a + i.caloriesSnapshot, 0)),
    items: m.items.map((i) => ({ name: i.name, grams: i.grams })),
  }));
}

export async function saveMealFromLogs(input: { name: string; date: string; mealType: MealType }) {
  const logs = await prisma.foodLog.findMany({
    where: { date: input.date, mealType: input.mealType },
    orderBy: { createdAt: "asc" },
  });
  if (!logs.length) throw new HttpError("Bu öğünde kaydedilecek bir şey yok.", 400);
  return prisma.savedMeal.create({
    data: {
      name: input.name,
      mealType: input.mealType,
      items: {
        create: logs.map((l, i) => ({
          foodItemId: l.foodItemId,
          recipeId: l.recipeId,
          name: l.name,
          grams: l.grams,
          caloriesSnapshot: l.caloriesSnapshot,
          proteinSnapshot: l.proteinSnapshot,
          carbsSnapshot: l.carbsSnapshot,
          fatSnapshot: l.fatSnapshot,
          orderIndex: i,
        })),
      },
    },
  });
}

export async function applySavedMeal(input: { savedMealId: string; date: string; mealType?: MealType; time?: string }) {
  const meal = await prisma.savedMeal.findUnique({
    where: { id: input.savedMealId },
    include: {
      items: {
        orderBy: { orderIndex: "asc" },
        include: { foodItem: true, recipe: { include: { ingredients: { include: { foodItem: true } } } } },
      },
    },
  });
  if (!meal) throw new HttpError("Kayıtlı öğün bulunamadı.", 404);
  const mealType = input.mealType ?? (meal.mealType as MealType | null) ?? "extra";
  const time = input.time ?? getLocalTimeString();

  const rows = meal.items.map((item) => {
    let macros = {
      calories: item.caloriesSnapshot,
      proteinG: item.proteinSnapshot,
      carbsG: item.carbsSnapshot,
      fatG: item.fatSnapshot,
    };
    if (item.foodItem) {
      const f = item.foodItem;
      macros = calculatePortionMacros({ ...f, basisGrams: f.basisGrams > 0 ? f.basisGrams : 100 }, item.grams);
    } else if (item.recipe?.ingredients.length) {
      const ingredients = item.recipe.ingredients.map((i) => ({ grams: i.grams, foodItem: i.foodItem }));
      const total = ingredients.reduce((a, i) => a + i.grams, 0);
      macros = scaleMacros(calculateRecipeMacros(ingredients), total > 0 ? item.grams / total : 0);
    }
    return {
      date: input.date,
      time,
      mealType,
      foodItemId: item.foodItemId,
      recipeId: item.recipeId,
      name: item.name,
      grams: item.grams,
      caloriesSnapshot: round1(macros.calories),
      proteinSnapshot: round1(macros.proteinG),
      carbsSnapshot: round1(macros.carbsG),
      fatSnapshot: round1(macros.fatG),
    };
  });
  await prisma.$transaction([
    prisma.foodLog.createMany({ data: rows }),
    prisma.savedMeal.update({ where: { id: meal.id }, data: { updatedAt: new Date() } }),
  ]);
  return { created: rows.length };
}

export async function deleteSavedMeal(id: string) {
  const res = await prisma.savedMeal.deleteMany({ where: { id } });
  if (res.count === 0) throw new HttpError("Kayıtlı öğün bulunamadı.", 404);
}

export async function copyFoodLogs(input: { fromDate: string; toDate: string; mealType?: MealType }) {
  if (input.fromDate === input.toDate) throw new HttpError("Kaynak ve hedef gün aynı olamaz.", 400);
  const logs = await prisma.foodLog.findMany({
    where: { date: input.fromDate, ...(input.mealType ? { mealType: input.mealType } : {}) },
    orderBy: { createdAt: "asc" },
  });
  if (!logs.length) throw new HttpError("Kopyalanacak öğün bulunamadı.", 400);
  await prisma.foodLog.createMany({
    data: logs.map((l) => ({
      date: input.toDate,
      time: l.time,
      mealType: l.mealType,
      foodItemId: l.foodItemId,
      recipeId: l.recipeId,
      name: l.name,
      grams: l.grams,
      caloriesSnapshot: l.caloriesSnapshot,
      proteinSnapshot: l.proteinSnapshot,
      carbsSnapshot: l.carbsSnapshot,
      fatSnapshot: l.fatSnapshot,
    })),
  });
  return { copied: logs.length };
}
