import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { SupplementLogInputSchema } from "@/lib/schemas/supplement";
import { logSupplement } from "@/lib/services/supplements";

/** F15: bir takviyeyi o gün için alındı / alınmadı işaretler. */
export async function POST(req: Request) {
  try {
    const input = SupplementLogInputSchema.parse(await req.json());
    return NextResponse.json(await logSupplement(input.supplementId, input.taken, input.date));
  } catch (error) {
    return apiError(error, "Takviye kaydı güncellenemedi", "Supplement log POST");
  }
}
