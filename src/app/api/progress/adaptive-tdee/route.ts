import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { loadAdaptiveTdee } from "@/lib/services/adaptive-tdee";

/** F10: kilo eğilimi ve alımdan harcama tahmini, formülle karşılaştırma ve hedef önerisi. */
export async function GET() {
  try {
    return NextResponse.json(await loadAdaptiveTdee());
  } catch (error) {
    return apiError(error, "Harcama tahmini yapılamadı", "AdaptiveTdee GET");
  }
}
