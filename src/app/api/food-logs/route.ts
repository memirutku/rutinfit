import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { targetsFromProfile } from "@/lib/constants";
import { MealTypeSchema } from "@/lib/schemas/enums";
import {
  calculateDailySummary,
  calculatePortionMacros,
  calculateRecipeMacros,
  calculateRecipePortion,
  scaleMacros,
} from "@/lib/nutrition-calculator";
import { getLocalDateString, isDateString } from "@/lib/date-utils";

const FoodLogCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().default("12:00"),
  mealType: MealTypeSchema,
  foodItemId: z.string().optional().nullable(),
  recipeId: z.string().optional().nullable(),
  name: z.string().min(1),
  /** Gram ya da (tarif için) porsiyon sayısı verilmelidir. */
  grams: z.number().positive().optional(),
  servings: z.number().positive().optional(),
  caloriesSnapshot: z.number().nonnegative().optional(),
  proteinSnapshot: z.number().nonnegative().optional(),
  carbsSnapshot: z.number().nonnegative().optional(),
  fatSnapshot: z.number().nonnegative().optional(),
}).refine((v) => v.grams !== undefined || (v.servings !== undefined && !!v.recipeId), {
  message: "grams veya (tarif için) servings zorunludur.",
  path: ["grams"],
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || getLocalDateString();
    if (!isDateString(date)) {
      return NextResponse.json({ error: "date YYYY-AA-GG olmalıdır." }, { status: 400 });
    }

    const logs = await prisma.foodLog.findMany({
      where: { date },
      orderBy: { createdAt: "asc" },
      include: {
        foodItem: true,
        recipe: true,
      },
    });

    const profile = await prisma.userProfile.findUnique({
      where: { id: "default-user" },
    });

    const targets = targetsFromProfile(profile);

    const summary = calculateDailySummary(
      logs.map((l) => ({
        calories: l.caloriesSnapshot,
        proteinG: l.proteinSnapshot,
        carbsG: l.carbsSnapshot,
        fatG: l.fatSnapshot,
      })),
      targets
    );

    return NextResponse.json({
      date,
      logs,
      summary,
      targets,
    });
  } catch (error) {
    return apiError(error, "Kayıtlar getirilemedi", "FoodLog GET");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = FoodLogCreateSchema.parse(body);

    let grams = validated.grams ?? 0;
    let macros = {
      calories: validated.caloriesSnapshot ?? 0,
      proteinG: validated.proteinSnapshot ?? 0,
      carbsG: validated.carbsSnapshot ?? 0,
      fatG: validated.fatSnapshot ?? 0,
    };

    // Katalog besini veya tarife bağlı kayıtlar sunucuda deterministik olarak yeniden hesaplanır;
    // istemcinin gönderdiği makrolar yalnız serbest girişte kullanılır.
    if (validated.foodItemId) {
      const foodItem = await prisma.foodItem.findUnique({ where: { id: validated.foodItemId } });
      if (foodItem) {
        macros = calculatePortionMacros(
          { ...foodItem, basisGrams: foodItem.basisGrams > 0 ? foodItem.basisGrams : 100 },
          grams
        );
      }
    } else if (validated.recipeId) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: validated.recipeId },
        include: { ingredients: { include: { foodItem: true } } },
      });

      if (recipe && recipe.ingredients.length > 0) {
        const ingredients = recipe.ingredients.map((ing) => ({ grams: ing.grams, foodItem: ing.foodItem }));
        if (validated.servings !== undefined) {
          const portion = calculateRecipePortion(ingredients, recipe.servings, validated.servings);
          grams = portion.grams;
          macros = portion.macros;
        } else {
          const totalGrams = ingredients.reduce((acc, i) => acc + i.grams, 0);
          macros = scaleMacros(calculateRecipeMacros(ingredients), totalGrams > 0 ? grams / totalGrams : 0);
        }
      }
    }

    if (!(grams > 0)) {
      return NextResponse.json({ error: "Gramaj hesaplanamadı." }, { status: 400 });
    }

    const caloriesSnapshot = macros.calories;
    const proteinSnapshot = macros.proteinG;
    const carbsSnapshot = macros.carbsG;
    const fatSnapshot = macros.fatG;

    const created = await prisma.foodLog.create({
      data: {
        date: validated.date,
        time: validated.time,
        mealType: validated.mealType,
        foodItemId: validated.foodItemId,
        recipeId: validated.recipeId,
        name: validated.name,
        grams,
        caloriesSnapshot,
        proteinSnapshot,
        carbsSnapshot,
        fatSnapshot,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error, "Öğün kaydedilemedi", "FoodLog POST");
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id zorunludur" }, { status: 400 });
    }

    await prisma.foodLog.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Kayıt silinemedi", "FoodLog DELETE");
  }
}
