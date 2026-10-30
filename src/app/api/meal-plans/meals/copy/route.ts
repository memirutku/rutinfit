import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/api-error";
import { PlannedMealCopySchema } from "@/lib/schemas/planned-meal";

/** F30: planlı öğünü başka bir güne (ve isteğe bağlı başka öğüne) kopyalar. */
export async function POST(req: Request) {
  try {
    const { id, toDate, toMealType } = PlannedMealCopySchema.parse(await req.json());
    const source = await prisma.plannedMeal.findUnique({ where: { id } });
    if (!source) throw new HttpError("Öğün bulunamadı.", 404);
    const plan = await prisma.mealPlan.upsert({ where: { date: toDate }, update: {}, create: { date: toDate } });
    const created = await prisma.plannedMeal.create({
      data: {
        mealPlanId: plan.id,
        mealType: toMealType ?? source.mealType,
        recipeId: source.recipeId,
        customName: source.customName,
        plannedTime: source.plannedTime,
        servings: source.servings,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error, "Öğün kopyalanamadı", "PlannedMeal copy");
  }
}
