import { NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/date-utils";
import { exportAllData } from "@/lib/services/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const backup = await exportAllData();
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="rutinfit-backup-${getLocalDateString()}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Backup export error:", error);
    return NextResponse.json({ error: "Yedek dışa aktarılamadı" }, { status: 500 });
  }
}
