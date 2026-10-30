import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { SaveMealInputSchema } from "@/lib/schemas/saved-meals";
import { deleteSavedMeal, listSavedMeals, saveMealFromLogs } from "@/lib/services/saved-meals";

/** F01: Kayıtlı öğünler. */
export async function GET() {
  try {
    return NextResponse.json(await listSavedMeals());
  } catch (error) {
    return apiError(error, "Kayıtlı öğünler getirilemedi", "SavedMeals GET");
  }
}

export async function POST(req: Request) {
  try {
    const saved = await saveMealFromLogs(SaveMealInputSchema.parse(await req.json()));
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return apiError(error, "Öğün kaydedilemedi", "SavedMeals POST");
  }
}

export async function DELETE(req: Request) {
  try {
    await deleteSavedMeal(new URL(req.url).searchParams.get("id") || "");
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Kayıtlı öğün silinemedi", "SavedMeals DELETE");
  }
}
