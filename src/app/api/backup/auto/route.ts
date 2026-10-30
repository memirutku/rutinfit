import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { getAutoBackupSettings, runAutoBackup, saveAutoBackupSettings, suggestedBackupFolder } from "@/lib/services/auto-backup";

export const dynamic = "force-dynamic";

const UpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    folderPath: z.string().max(1000).nullable().optional(),
    frequency: z.enum(["daily", "weekly"]).optional(),
    keepCount: z.number().int().min(1).max(100).optional(),
  })
  .strict();

const view = (s: Awaited<ReturnType<typeof getAutoBackupSettings>>) => ({
  enabled: s.enabled,
  folderPath: s.folderPath,
  frequency: s.frequency,
  keepCount: s.keepCount,
  lastRunAt: s.lastRunAt,
  lastStatus: s.lastStatus,
  lastMessage: s.lastMessage,
  lastFile: s.lastFile,
  suggestedFolder: suggestedBackupFolder(),
});

/** F61: otomatik yedek ayarları ve son çalışma durumu. */
export async function GET() {
  try {
    return NextResponse.json(view(await getAutoBackupSettings()));
  } catch (error) {
    return apiError(error, "Otomatik yedek ayarları getirilemedi", "AutoBackup GET");
  }
}

export async function PUT(req: Request) {
  try {
    await saveAutoBackupSettings(UpdateSchema.parse(await req.json()));
    return NextResponse.json(view(await getAutoBackupSettings()));
  } catch (error) {
    return apiError(error, "Otomatik yedek ayarları kaydedilemedi", "AutoBackup PUT");
  }
}

/** F61: şimdi yedekle. */
export async function POST() {
  try {
    const result = await runAutoBackup();
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    return apiError(error, "Yedek alınamadı", "AutoBackup POST");
  }
}
