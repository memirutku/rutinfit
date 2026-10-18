import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { calculateDailySummary } from "@/lib/nutrition-calculator";
import { getLocalDateString } from "@/lib/date-utils";

const FoodLogCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().default("12:00"),
  mealType: z.enum(["breakfast", "lunch", "workSnack", "dinner", "extra"]),
  foodItemId: z.string().optional().nullable(),
  recipeId: z.string().optional().nullable(),
  name: z.string().min(1),
  grams: z.number().positive(),
  caloriesSnapshot: z.number().nonnegative().optional(),
  proteinSnapshot: z.number().nonnegative().optional(),
  carbsSnapshot: z.number().nonnegative().optional(),
  fatSnapshot: z.number().nonnegative().optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || getLocalDateString();

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

    const targets = profile
      ? {
          calorieTarget: profile.calorieTarget,
          calorieCeiling: profile.calorieCeiling,
          proteinTargetG: profile.proteinTargetG,
          fatTargetG: profile.fatTargetG,
          carbTargetG: profile.carbTargetG,
        }
      : {
          calorieTarget: 2080,
          calorieCeiling: 2100,
          proteinTargetG: 165,
          fatTargetG: 60,
          carbTargetG: 220,
        };

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
    console.error("FoodLog GET error:", error);
    return NextResponse.json(
      { error: "Kayıtlar getirilemedi" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = FoodLogCreateSchema.parse(body);

    let caloriesSnapshot = validated.caloriesSnapshot ?? 0;
    let proteinSnapshot = validated.proteinSnapshot ?? 0;
    let carbsSnapshot = validated.carbsSnapshot ?? 0;
    let fatSnapshot = validated.fatSnapshot ?? 0;

    // Server-side deterministic recalculation if linked to foodItem or recipe
    if (validated.foodItemId) {
      const foodItem = await prisma.foodItem.findUnique({
        where: { id: validated.foodItemId },
      });

      if (foodItem) {
        const basis = foodItem.basisGrams > 0 ? foodItem.basisGrams : 100;
        const multiplier = validated.grams / basis;
        caloriesSnapshot = Math.round(foodItem.calories * multiplier * 10) / 10;
        proteinSnapshot = Math.round(foodItem.proteinG * multiplier * 10) / 10;
        carbsSnapshot = Math.round(foodItem.carbsG * multiplier * 10) / 10;
        fatSnapshot = Math.round(foodItem.fatG * multiplier * 10) / 10;
      }
    } else if (validated.recipeId) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: validated.recipeId },
        include: {
          ingredients: {
            include: { foodItem: true },
          },
        },
      });

      if (recipe && recipe.ingredients.length > 0) {
        let totalCal = 0;
        let totalP = 0;
        let totalC = 0;
        let totalF = 0;
        let totalGrams = 0;

        for (const ing of recipe.ingredients) {
          const item = ing.foodItem;
          const basis = item.basisGrams > 0 ? item.basisGrams : 100;
          const mult = ing.grams / basis;
          totalCal += item.calories * mult;
          totalP += item.proteinG * mult;
          totalC += item.carbsG * mult;
          totalF += item.fatG * mult;
          totalGrams += ing.grams;
        }

        const servings = recipe.servings > 0 ? recipe.servings : 1;
        // If logged grams equals total weight, or ratio
        const ratio = totalGrams > 0 ? validated.grams / (totalGrams / servings) : 1;
        caloriesSnapshot = Math.round((totalCal / servings) * ratio * 10) / 10;
        proteinSnapshot = Math.round((totalP / servings) * ratio * 10) / 10;
        carbsSnapshot = Math.round((totalC / servings) * ratio * 10) / 10;
        fatSnapshot = Math.round((totalF / servings) * ratio * 10) / 10;
      }
    }

    const created = await prisma.foodLog.create({
      data: {
        date: validated.date,
        time: validated.time,
        mealType: validated.mealType,
        foodItemId: validated.foodItemId,
        recipeId: validated.recipeId,
        name: validated.name,
        grams: validated.grams,
        caloriesSnapshot,
        proteinSnapshot,
        carbsSnapshot,
        fatSnapshot,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("FoodLog POST error:", error);
    return NextResponse.json(
      { error: error.message || "Öğün kaydedilemedi" },
      { status: 400 }
    );
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
    console.error("FoodLog DELETE error:", error);
    return NextResponse.json(
      { error: "Kayıt silinemedi" },
      { status: 500 }
    );
  }
}
