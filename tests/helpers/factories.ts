import { prisma } from "@/lib/prisma";

let seq = 0;
const uniq = (prefix: string) => `${prefix}_${++seq}_${Math.random().toString(36).slice(2, 7)}`;

export async function createProfile(overrides: Partial<Parameters<typeof prisma.userProfile.create>[0]["data"]> = {}) {
  return prisma.userProfile.upsert({
    where: { id: "default-user" },
    update: overrides,
    create: { id: "default-user", ...overrides },
  });
}

export async function createFood(
  overrides: Partial<{
    name: string;
    category: string;
    basisGrams: number;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    barcode: string | null;
    brand: string | null;
  }> = {}
) {
  return prisma.foodItem.create({
    data: {
      name: overrides.name ?? uniq("Besin"),
      category: overrides.category ?? "Genel",
      basisGrams: overrides.basisGrams ?? 100,
      calories: overrides.calories ?? 100,
      proteinG: overrides.proteinG ?? 10,
      carbsG: overrides.carbsG ?? 10,
      fatG: overrides.fatG ?? 2,
      barcode: overrides.barcode ?? null,
      brand: overrides.brand ?? null,
    },
  });
}

export async function createRecipe(
  ingredients: Array<{ foodItemId: string; grams: number }>,
  overrides: Partial<{ name: string; servings: number; prepMinutes: number }> = {}
) {
  return prisma.recipe.create({
    data: {
      name: overrides.name ?? uniq("Tarif"),
      servings: overrides.servings ?? 1,
      prepMinutes: overrides.prepMinutes ?? 15,
      ingredients: { create: ingredients },
    },
    include: { ingredients: { include: { foodItem: true } } },
  });
}

export async function createMealPlan(
  date: string,
  meals: Array<{ mealType: string; recipeId?: string; customName?: string; servings?: number }>
) {
  return prisma.mealPlan.create({
    data: {
      date,
      meals: {
        create: meals.map((m) => ({
          mealType: m.mealType,
          recipeId: m.recipeId,
          customName: m.customName,
          servings: m.servings ?? 1,
        })),
      },
    },
    include: { meals: true },
  });
}
