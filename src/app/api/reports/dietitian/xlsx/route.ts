import { apiError } from "@/lib/api-error";
import { buildDietitianReport, reportToXlsx } from "@/lib/services/dietitian-report";
import { saveExportCopy } from "@/lib/services/export-files";

export const dynamic = "force-dynamic";

/** F77: aynı rapor Excel olarak (Özet, Günlük, Öğün günlüğü). */
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    const report = await buildDietitianReport(p.get("from"), p.get("to"));
    const file = reportToXlsx(report);
    const fileName = `rutinfit-diyetisyen-raporu-${report.from}_${report.to}.xlsx`;
    const saved = await saveExportCopy(file, fileName);
    const headers: Record<string, string> = {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
    };
    if (saved) headers["x-rutinfit-export-path"] = encodeURIComponent(saved);
    return new Response(new Uint8Array(file), { status: 200, headers });
  } catch (error) {
    return apiError(error, "Excel raporu hazırlanamadı", "Dietitian report XLSX");
  }
}
