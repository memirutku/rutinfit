import { NextResponse } from "next/server";
import { buildDiagnostics } from "@/lib/services/diagnostics";

export const dynamic = "force-dynamic";

/** B38: tanılama (bütün tablolar, tam yollar, iki yedek klasörü, sürüm, günlük dosyası). */
export async function GET() {
  try {
    return NextResponse.json(await buildDiagnostics(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Diagnostics error:", error);
    const message = error instanceof Error && error.message ? error.message : "Tanılama verileri alınamadı";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
