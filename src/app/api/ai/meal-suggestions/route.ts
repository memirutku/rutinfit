import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { suggestMealsWithoutModel } from "@/lib/services/meal-suggestions";

/** B42: yapay zekâ kullanmadan, bugün kalan kalori ve makroya göre kayıtlı öğün ve tarif önerisi. */
export async function GET() {
  try {
    return NextResponse.json(await suggestMealsWithoutModel(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error, "Öneriler hazırlanamadı", "Meal suggestions GET");
  }
}
