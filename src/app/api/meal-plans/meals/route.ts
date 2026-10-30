import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/api-error";
import { PlannedMealCreateSchema, PlannedMealUpdateSchema } from "@/lib/schemas/planned-meal";

/** Gün planını bulur ya da oluşturur. */
const planFor = (date: string) => prisma.mealPlan.upsert({ where: { date }, update: {}, create: { date } });

/** F30: güne öğün ekler. */
export async function POST(req: Request) {
  try {
    const { date, ...meal } = PlannedMealCreateSchema.parse(await req.json());
    const plan = await planFor(date);
    const created = await prisma.plannedMeal.create({
      data: { mealPlanId: plan.id, mealType: meal.mealType, recipeId: meal.recipeId ?? null, customName: meal.customName ?? null, plannedTime: meal.plannedTime ?? null, servings: meal.servings },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error, "Öğün eklenemedi", "PlannedMeal POST");
  }
}

/** F30: öğünü taşır (gün/öğün) ya da düzenler (tarif, ad, porsiyon). */
export async function PATCH(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const { date, logged, ...patch } = PlannedMealUpdateSchema.parse(await req.json());
    if (!(await prisma.plannedMeal.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError("Öğün bulunamadı.", 404);
    const mealPlanId = date ? (await planFor(date)).id : undefined;
    const updated = await prisma.plannedMeal.update({ where: { id }, data: { ...patch, ...(mealPlanId && { mealPlanId }), ...(logged !== undefined && { loggedAt: logged ? new Date() : null }) } });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, "Öğün güncellenemedi", "PlannedMeal PATCH");
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const res = await prisma.plannedMeal.deleteMany({ where: { id } });
    if (res.count === 0) throw new HttpError("Öğün bulunamadı.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Öğün silinemedi", "PlannedMeal DELETE");
  }
}
