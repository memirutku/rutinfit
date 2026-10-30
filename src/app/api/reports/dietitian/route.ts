import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { buildDietitianReport } from "@/lib/services/dietitian-report";

/** F77: GET ?from=&to= (en çok 92 gün; varsayılan son 7 gün). */
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    return NextResponse.json(await buildDietitianReport(p.get("from"), p.get("to")));
  } catch (error) {
    return apiError(error, "Rapor hazırlanamadı", "Dietitian report GET");
  }
}
