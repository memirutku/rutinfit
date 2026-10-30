import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getLocalDateString, getLocalTimeString } from "@/lib/date-utils";
import { mealTypeForHour } from "@/lib/meal-time";
import { calculatePortionMacros } from "@/lib/nutrition-calculator";
import { QUICK_FOOD_IDS, QUICK_FOODS } from "@/lib/quick-foods";
import { MealTypeSchema } from "@/lib/schemas/enums";

const QuickAddSchema = z.object({
  item: z.enum(QUICK_FOOD_IDS),
  count: z.number().int().min(1).max(10).default(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  mealType: MealTypeSchema.optional(),
});

/**
 * F79: Simit, ekmek dilimi gibi kalemleri tek tıkla günlüğe yazar. Kalem katalogda yoksa bir
 * kez oluşturulur (kaynak "RutinFit", güven "Tahmini"); kullanıcı sonra düzenleyebilir.
 */
export async function POST(req: Request) {
  try {
    const input = QuickAddSchema.parse(await req.json());
    const def = QUICK_FOODS[input.item];
    const time = input.time ?? getLocalTimeString();

    const food =
      (await prisma.foodItem.findFirst({ where: { name: def.name, source: "RutinFit" } })) ??
      (await prisma.foodItem.create({
        data: {
          name: def.name,
          category: def.category,
          basisGrams: def.basisGrams,
          calories: def.calories,
          proteinG: def.proteinG,
          carbsG: def.carbsG,
          fatG: def.fatG,
          source: "RutinFit",
          confidence: "Tahmini",
        },
      }));

    const grams = def.portionGrams * input.count;
    const macros = calculatePortionMacros(food, grams);
    const log = await prisma.foodLog.create({
      data: {
        date: input.date ?? getLocalDateString(),
        time,
        mealType: input.mealType ?? mealTypeForHour(Number(time.slice(0, 2))),
        foodItemId: food.id,
        name: `${def.name} (${input.count} ${def.unit})`,
        grams,
        caloriesSnapshot: macros.calories,
        proteinSnapshot: macros.proteinG,
        carbsSnapshot: macros.carbsG,
        fatSnapshot: macros.fatG,
      },
    });
    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    return apiError(error, "Hızlı ekleme yapılamadı", "QuickAdd POST");
  }
}
