import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { getAIStatus } from "@/lib/services/ai-status";

/** B28: kayıtlı model sunucusu şu an çalışıyor mu, seçili model yüklü mü? */
export async function GET() {
  try {
    return NextResponse.json(await getAIStatus(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error, "Yapay zekâ durumu denetlenemedi", "AI status GET");
  }
}
