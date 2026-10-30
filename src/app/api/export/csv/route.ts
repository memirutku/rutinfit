import { NextResponse } from "next/server";
import { getLocalDateString, isDateString } from "@/lib/date-utils";
import { CSV_BUILDERS, CSV_EXPORT_TYPES, type CsvExportType } from "@/lib/services/csv-export";
import { saveExportCopy } from "@/lib/services/export-files";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/** F60: GET /api/export/csv?type=food-log|workouts|body[&from=YYYY-MM-DD][&to=YYYY-MM-DD] */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const type = params.get("type") as CsvExportType;
    if (!(type in CSV_EXPORT_TYPES)) {
      return NextResponse.json({ error: "Bilinmeyen dışa aktarma türü." }, { status: 400 });
    }
    const from = params.get("from") ?? undefined;
    const to = params.get("to") ?? undefined;
    if ((from && !isDateString(from)) || (to && !isDateString(to))) {
      return NextResponse.json({ error: "Tarih YYYY-AA-GG biçiminde olmalıdır." }, { status: 400 });
    }
    const csv = await CSV_BUILDERS[type]({ from, to });
    const fileName = `rutinfit-${CSV_EXPORT_TYPES[type]}-${getLocalDateString()}.csv`;
    const saved = saveExportCopy(csv, fileName);
    const headers: Record<string, string> = {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    };
    if (saved) headers["X-RutinFit-Export-Path"] = encodeURIComponent(saved);
    return new NextResponse(csv, { status: 200, headers });
  } catch (error) {
    return apiError(error, "CSV dışa aktarılamadı", "CSV export");
  }
}
