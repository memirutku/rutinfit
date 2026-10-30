import { apiError } from "@/lib/api-error";
import { getLocalDateString } from "@/lib/date-utils";
import { remindersToIcs } from "@/lib/reminders-ics";
import { saveExportCopy } from "@/lib/services/export-files";
import { listReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

/** B41: hatırlatmalar takvim dosyası (.ics) olarak; telefonun takvimine eklenebilir. */
export async function GET() {
  try {
    const ics = remindersToIcs(await listReminders());
    const fileName = `rutinfit-hatirlatmalar-${getLocalDateString()}.ics`;
    const saved = await saveExportCopy(ics, fileName);
    const headers: Record<string, string> = {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    };
    if (saved) headers["X-RutinFit-Export-Path"] = encodeURIComponent(saved);
    return new Response(ics, { status: 200, headers });
  } catch (error) {
    return apiError(error, "Takvim dosyası hazırlanamadı", "Reminders ICS");
  }
}
