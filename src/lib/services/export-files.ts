import fs from "node:fs";
import path from "node:path";
import { prisma } from "../prisma";
import { appTimeZone } from "../date-utils";
import { getStoragePaths } from "../storage-paths";

/**
 * B36: dosya adlarındaki zaman damgası uygulamanın yerel saatindedir ("Son yedek" satırıyla aynı):
 * `2026-10-30_16-57-24`. Sözlük sırası zaman sırasıdır.
 */
export function localFileStamp(now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: appTimeZone(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}-${parts.second}`;
}

/**
 * Klasörde aynı ad varsa sonuna `_2`, `_3` … eklenir. `_` noktadan sonra sıralandığı için ek alan
 * dosya aynı saniyedeki ilkinden sonra gelir (budama en eskiyi siler).
 */
export function uniqueFilePath(dir: string, fileName: string): string {
  const ext = path.extname(fileName);
  const base = fileName.slice(0, fileName.length - ext.length);
  let candidate = path.join(/*turbopackIgnore: true*/ dir, fileName);
  for (let n = 2; fs.existsSync(/*turbopackIgnore: true*/ candidate); n++) {
    candidate = path.join(/*turbopackIgnore: true*/ dir, `${base}_${n}${ext}`);
  }
  return candidate;
}

/** B36: dışa aktarma kopyası ayarı (varsayılan açık; Ayarlar › Gelişmiş › Yedek ayrıntıları). */
export async function exportCopiesEnabled(): Promise<boolean> {
  try {
    const settings = await prisma.autoBackupSettings.findUnique({ where: { id: "default" }, select: { exportCopies: true } });
    return settings?.exportCopies ?? true;
  } catch {
    return true;
  }
}

/**
 * Masaüstü görünümünde indirme engellense bile dosya kaybolmasın: uygulama klasöründeki
 * `exports` altına bir kopya yazılır. Ayar kapalıysa ya da yazılamazsa null döner (indirme yine çalışır).
 */
export async function saveExportCopy(content: string | Buffer, fileName: string): Promise<string | null> {
  if (!(await exportCopiesEnabled())) return null;
  try {
    // turbopackIgnore: kullanıcı veri klasörü; derleyici bu yolu izleyip pakete katmasın.
    const dir = path.join(/*turbopackIgnore: true*/ getStoragePaths().dataDir, "exports");
    fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    const file = path.join(/*turbopackIgnore: true*/ dir, path.basename(fileName));
    fs.writeFileSync(file, content);
    return file;
  } catch (error) {
    console.error("Export local copy error:", error);
    return null;
  }
}
