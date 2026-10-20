import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/date-utils";
import { exportAllData } from "@/lib/services/backup";
import { getStoragePaths } from "@/lib/storage-paths";

export const dynamic = "force-dynamic";

/** Uygulama klasöründe tutulacak dışa aktarma kopyası sayısı (eskiler silinir). */
const KEEP_EXPORT_COPIES = 20;

/**
 * Her dışa aktarmada bir kopya uygulamanın backups/ klasörüne de yazılır: masaüstü
 * görünümünde indirme engellense bile yedek kaybolmaz.
 */
function saveLocalCopy(json: string, stamp: string): string | null {
  try {
    const dir = getStoragePaths().backupsDir;
    const file = path.join(dir, `rutinfit-backup-${stamp}.json`);
    fs.writeFileSync(file, json, "utf8");
    const copies = fs
      .readdirSync(dir)
      .filter((f) => /^rutinfit-backup-.*\.json$/.test(f))
      .sort();
    for (const old of copies.slice(0, Math.max(0, copies.length - KEEP_EXPORT_COPIES))) {
      fs.rmSync(path.join(dir, old), { force: true });
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
    const stamp = `${getLocalDateString()}_${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
    const savedPath = saveLocalCopy(json, stamp);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="rutinfit-backup-${getLocalDateString()}.json"`,
      "Cache-Control": "no-store",
    };
    if (savedPath) headers["X-RutinFit-Backup-Path"] = encodeURIComponent(savedPath);
    return new NextResponse(json, { status: 200, headers });
  } catch (error) {
    console.error("Backup export error:", error);
    return NextResponse.json({ error: "Yedek dışa aktarılamadı" }, { status: 500 });
  }
}
