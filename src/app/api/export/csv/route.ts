import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getLocalDateString, isDateString } from "@/lib/date-utils";
import { CSV_BUILDERS, CSV_EXPORT_TYPES, type CsvExportType } from "@/lib/services/csv-export";
import { getStoragePaths } from "@/lib/storage-paths";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/** Masaüstü görünümünde indirme engellense bile dosya kaybolmasın: uygulama klasörüne kopya. */
function saveLocalCopy(csv: string, fileName: string): string | null {
  try {
    // turbopackIgnore: kullanıcı veri klasörü; derleyici bu yolu izleyip pakete katmasın.
    const dir = path.join(/*turbopackIgnore: true*/ getStoragePaths().dataDir, "exports");
    fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    const file = path.join(/*turbopackIgnore: true*/ dir, fileName);
    fs.writeFileSync(file, csv, "utf8");
    return file;
  } catch (error) {
    console.error("CSV local copy error:", error);
    return null;
  }
}

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
    const saved = saveLocalCopy(csv, fileName);
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
