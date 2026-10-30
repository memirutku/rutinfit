import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { exportAllData } from "@/lib/services/backup";
import { exportCopiesEnabled, localFileStamp, uniqueFilePath } from "@/lib/services/export-files";
import { getStoragePaths } from "@/lib/storage-paths";

export const dynamic = "force-dynamic";

/** Uygulama klasöründe tutulacak dışa aktarma kopyası sayısı (eskiler silinir). */
const KEEP_EXPORT_COPIES = 20;

/**
 * Dışa aktarmanın bir kopyası uygulamanın backups/ klasörüne de yazılır: masaüstü görünümünde
 * indirme engellense bile yedek kaybolmaz. B36: ayar kapalıysa yazılmaz; kopya indirilen dosyayla
 * aynı (yerel saatli) adı taşır.
 */
async function saveLocalCopy(json: string, fileName: string): Promise<string | null> {
  if (!(await exportCopiesEnabled())) return null;
  try {
    // turbopackIgnore: kullanıcı veri klasörü; derleyici bu yolu izleyip yedekleri pakete katmasın.
    const dir = getStoragePaths().backupsDir;
    const file = uniqueFilePath(dir, fileName);
    fs.writeFileSync(/*turbopackIgnore: true*/ file, json, "utf8");
    const copies = fs
      .readdirSync(/*turbopackIgnore: true*/ dir)
      .filter((f) => /^rutinfit-backup-.*\.json$/.test(f))
      .sort();
    for (const old of copies.slice(0, Math.max(0, copies.length - KEEP_EXPORT_COPIES))) {
      fs.rmSync(path.join(/*turbopackIgnore: true*/ dir, old), { force: true });
    }
    return file;
  } catch (error) {
    console.error("Backup local copy error:", error);
    return null;
  }
}

export async function GET() {
  try {
    const backup = await exportAllData();
    const json = JSON.stringify(backup, null, 2);
    const fileName = `rutinfit-backup-${localFileStamp()}.json`;
    const savedPath = await saveLocalCopy(json, fileName);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    };
    if (savedPath) headers["X-RutinFit-Backup-Path"] = encodeURIComponent(savedPath);
    return new NextResponse(json, { status: 200, headers });
  } catch (error) {
    console.error("Backup export error:", error);
    return NextResponse.json({ error: "Yedek dışa aktarılamadı" }, { status: 500 });
  }
}
