import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { CopyFoodLogsInputSchema } from "@/lib/schemas/saved-meals";
import { copyFoodLogs } from "@/lib/services/saved-meals";

/** F01: Bir günün tüm öğünlerini ya da tek öğününü başka bir güne kopyalar. */
export async function POST(req: Request) {
  try {
    return NextResponse.json(await copyFoodLogs(CopyFoodLogsInputSchema.parse(await req.json())), { status: 201 });
  } catch (error) {
    return apiError(error, "Öğünler kopyalanamadı", "FoodLogs copy");
  }
}
