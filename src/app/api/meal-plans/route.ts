import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { calculateRecipePortion } from "@/lib/nutrition-calculator";
import { addDaysToDateString } from "@/lib/date-utils";

const PlannedMealItemSchema = z.object({
  mealType: z.string(),
  recipeId: z.string().optional().nullable(),
  customName: z.string().optional().nullable(),
  plannedTime: z.string().optional().nullable(),
  servings: z.number().positive().default(1),
  isCompleted: z.boolean().default(false),
});

const SaveMealPlanSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  meals: z.array(PlannedMealItemSchema),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const weekStart = searchParams.get("weekStart");

    const where: any = {};
    if (date) {
      where.date = date;
    } else if (weekStart) {
      // 7 günlük aralık
      where.date = {
        gte: weekStart,
        lt: addDaysToDateString(weekStart, 7),
      };
    }

    const plans = await prisma.mealPlan.findMany({
      where,
      include: {
        meals: {
          include: {
            recipe: {
              include: {
                ingredients: {
                  include: {
                    foodItem: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { date: "asc" },
    });

    const enrichedPlans = plans.map((plan) => {
      const enrichedMeals = plan.meals.map((meal) => {
        let calculatedMacros = null;
        if (meal.recipe) {
          // Tarifin tamamı recipe.servings porsiyondur; planlanan pay meal.servings porsiyon.
          calculatedMacros = calculateRecipePortion(
            meal.recipe.ingredients.map((ing) => ({ grams: ing.grams, foodItem: ing.foodItem })),
            meal.recipe.servings,
            meal.servings
          ).macros;
        }
        return {
          ...meal,
          calculatedMacros,
        };
      });

      return {
        ...plan,
        meals: enrichedMeals,
      };
    });

    return NextResponse.json(enrichedPlans);
  } catch (error) {
    console.error("MealPlan GET error:", error);
    return NextResponse.json(
      { error: "Yemek planı getirilemedi" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = SaveMealPlanSchema.parse(body);

    const plan = await prisma.mealPlan.upsert({
      where: { date: validated.date },
      update: {
        notes: validated.notes,
        meals: {
          deleteMany: {},
          create: validated.meals.map((m) => ({
            mealType: m.mealType,
            recipeId: m.recipeId || null,
            customName: m.customName || null,
            plannedTime: m.plannedTime || null,
            servings: m.servings,
            isCompleted: m.isCompleted,
          })),
        },
      },
      create: {
        date: validated.date,
        notes: validated.notes,
        meals: {
          create: validated.meals.map((m) => ({
            mealType: m.mealType,
            recipeId: m.recipeId || null,
            customName: m.customName || null,
            plannedTime: m.plannedTime || null,
            servings: m.servings,
            isCompleted: m.isCompleted,
          })),
        },
      },
      include: {
        meals: {
          include: {
            recipe: true,
          },
        },
      },
    });

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error("MealPlan POST error:", error);
    return NextResponse.json(
      { error: error.message || "Yemek planı kaydedilemedi" },
      { status: 400 }
    );
  }
}
