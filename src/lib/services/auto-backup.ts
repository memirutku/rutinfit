/**
 * F61: Kullanıcının seçtiği klasöre zamanlanmış otomatik yedek. iCloud Drive ya da Syncthing
 * klasörü seçilirse yedekler diğer cihazlara da ulaşır (eşitleme yerine pragmatik çözüm).
 * Yalnız bu uygulamanın yazdığı dosyalar (`rutinfit-otomatik-yedek-*.json`) budanır.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "../prisma";
import { HttpError } from "../api-error";
import { exportAllData } from "./backup";
import { localFileStamp, uniqueFilePath } from "./export-files";

const ID = "default";
const FILE_PREFIX = "rutinfit-otomatik-yedek-";
const INTERVAL_MS = { daily: 24 * 3_600_000, weekly: 7 * 24 * 3_600_000 } as const;
export type AutoBackupFrequency = keyof typeof INTERVAL_MS;

export const suggestedBackupFolder = () => path.join(os.homedir(), "Documents", "RutinFit Yedekleri");

export function isAutoBackupDue(
  s: { enabled: boolean; folderPath: string | null; frequency: string; lastRunAt: Date | null },
  now = new Date()
): boolean {
  if (!s.enabled || !s.folderPath) return false;
  if (!s.lastRunAt) return true;
  const interval = INTERVAL_MS[s.frequency as AutoBackupFrequency] ?? INTERVAL_MS.daily;
  return now.getTime() - s.lastRunAt.getTime() >= interval;
}

/** Mutlak, yazılabilir bir klasör olmalı; yoksa (üst klasörü varsa) oluşturulur. */
export function prepareFolder(folderPath: string): string {
  if (!path.isAbsolute(folderPath)) throw new HttpError("Klasör tam yol olmalıdır (ör. /Users/ad/Belgeler/RutinFit Yedekleri).", 400);
  const resolved = path.resolve(/*turbopackIgnore: true*/ folderPath);
  try {
    fs.mkdirSync(/*turbopackIgnore: true*/ resolved, { recursive: true });
    if (!fs.statSync(/*turbopackIgnore: true*/ resolved).isDirectory()) throw new Error("dizin değil");
    fs.accessSync(/*turbopackIgnore: true*/ resolved, fs.constants.W_OK);
  } catch {
    throw new HttpError("Klasöre yazılamıyor. Var olan ve yazma izni olan bir klasör seç.", 400);
  }
  return resolved;
}

export async function getAutoBackupSettings() {
  return (
    (await prisma.autoBackupSettings.findUnique({ where: { id: ID } })) ?? {
      id: ID,
      enabled: false,
      folderPath: null,
      frequency: "daily",
      keepCount: 10,
      lastRunAt: null,
      lastStatus: null,
      lastMessage: null,
      lastFile: null,
      exportCopies: true,
      updatedAt: new Date(0),
    }
  );
}

export async function saveAutoBackupSettings(input: {
  enabled?: boolean;
  folderPath?: string | null;
  frequency?: AutoBackupFrequency;
  keepCount?: number;
  exportCopies?: boolean;
}) {
  const current = await getAutoBackupSettings();
  const folderPath = input.folderPath === undefined ? current.folderPath : input.folderPath?.trim() || null;
  const enabled = input.enabled ?? current.enabled;
  if (enabled && !folderPath) throw new HttpError("Otomatik yedek için bir klasör seç.", 400);
  const data = {
    enabled,
    folderPath: folderPath && enabled ? prepareFolder(folderPath) : folderPath,
    frequency: input.frequency ?? current.frequency,
    keepCount: input.keepCount ?? current.keepCount,
    exportCopies: input.exportCopies ?? current.exportCopies,
  };
  return prisma.autoBackupSettings.upsert({ where: { id: ID }, update: data, create: { id: ID, ...data } });
}

export interface AutoBackupResult {
  ok: boolean;
  message: string;
  file?: string;
}

export async function runAutoBackup(now = new Date()): Promise<AutoBackupResult> {
  const settings = await getAutoBackupSettings();
  let result: AutoBackupResult;
  try {
    if (!settings.folderPath) throw new Error("Otomatik yedek klasörü seçilmemiş.");
    if (!fs.existsSync(/*turbopackIgnore: true*/ settings.folderPath)) throw new Error(`Klasör bulunamadı: ${settings.folderPath}`);
    // B36: yerel saatli ad; aynı saniyedeki ikinci yedek üzerine yazmaz.
    const file = uniqueFilePath(settings.folderPath, `${FILE_PREFIX}${localFileStamp(now)}.json`);
    fs.writeFileSync(/*turbopackIgnore: true*/ file, JSON.stringify(await exportAllData(), null, 2), "utf8");
    const ours = fs
      .readdirSync(/*turbopackIgnore: true*/ settings.folderPath)
      .filter((f) => f.startsWith(FILE_PREFIX) && f.endsWith(".json"))
      .sort();
    for (const old of ours.slice(0, Math.max(0, ours.length - settings.keepCount))) {
      fs.rmSync(path.join(/*turbopackIgnore: true*/ settings.folderPath, old), { force: true });
    }
    result = { ok: true, message: "Yedek alındı.", file };
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : "Yedek alınamadı." };
  }
  await prisma.autoBackupSettings.upsert({
    where: { id: ID },
    update: { lastRunAt: now, lastStatus: result.ok ? "ok" : "error", lastMessage: result.message, lastFile: result.file ?? null },
    create: { id: ID, lastRunAt: now, lastStatus: result.ok ? "ok" : "error", lastMessage: result.message, lastFile: result.file ?? null },
  });
  return result;
}

/** Sunucu açıkken yarım saatte bir (ve açılıştan bir dakika sonra) zamanı geldiyse yedek alır. */
export function startAutoBackupScheduler() {
  const g = globalThis as { __rutinfitAutoBackup?: NodeJS.Timeout };
  if (g.__rutinfitAutoBackup || process.env.NODE_ENV === "test") return;
  const tick = async () => {
    try {
      if (isAutoBackupDue(await getAutoBackupSettings())) await runAutoBackup();
    } catch (error) {
      console.error("[auto-backup]", error);
    }
  };
  setTimeout(tick, 60_000).unref?.();
  g.__rutinfitAutoBackup = setInterval(tick, 30 * 60_000);
  g.__rutinfitAutoBackup.unref?.();
}
