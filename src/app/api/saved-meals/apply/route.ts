import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { ApplySavedMealInputSchema } from "@/lib/schemas/saved-meals";
import { applySavedMeal } from "@/lib/services/saved-meals";

/** F01: Kayıtlı öğünü bir güne ekler. */
export async function POST(req: Request) {
  try {
    return NextResponse.json(await applySavedMeal(ApplySavedMealInputSchema.parse(await req.json())), { status: 201 });
  } catch (error) {
    return apiError(error, "Kayıtlı öğün eklenemedi", "SavedMeals apply");
  }
}
