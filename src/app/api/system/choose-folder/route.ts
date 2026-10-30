import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { ChooseFolderRequestSchema } from "@/lib/schemas/local-files";
import { getAutoBackupSettings, suggestedBackupFolder } from "@/lib/services/auto-backup";
import { chooseFolder } from "@/lib/services/local-files";

export const dynamic = "force-dynamic";

/** B36: otomatik yedek klasörü için macOS klasör seçme penceresi. Vazgeçilirse { path: null }. */
export async function POST(req: Request) {
  try {
    ChooseFolderRequestSchema.parse(await req.json().catch(() => ({})));
    const current = (await getAutoBackupSettings()).folderPath;
    const path = await chooseFolder("RutinFit yedeklerinin kaydedileceği klasörü seç", current ?? suggestedBackupFolder());
    return NextResponse.json({ path });
  } catch (error) {
    return apiError(error, "Klasör seçilemedi", "Choose folder POST");
  }
}
