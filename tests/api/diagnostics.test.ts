import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/diagnostics/route";
import { PUT as putAutoBackup } from "@/app/api/backup/auto/route";
import { BACKUP_TABLES, EXCLUDED_TABLES } from "@/lib/services/backup";
import { DiagnosticsSchema } from "@/lib/schemas/system";
import { getStoragePaths } from "@/lib/storage-paths";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import packageJson from "../../package.json";

let autoDir: string;
beforeEach(async () => {
  await resetDatabase();
  autoDir = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-diag-auto-"));
});
afterEach(() => fs.rmSync(autoDir, { recursive: true, force: true }));

describe("B38: tanılama", () => {
  it("bütün tabloları Türkçe adıyla sayar (kardiyo, Apple Sağlık, sohbet dahil)", async () => {
    await prisma.cardioLog.create({ data: { date: "2026-10-30", kind: "run", durationMin: 30, distanceKm: 5 } });
    await prisma.healthRecord.create({ data: { key: "steps:2026-10-30", type: "steps", date: "2026-10-30", value: 6400, unit: "count", source: "Watch" } });
    await prisma.aIConversation.create({ data: { title: "Deneme" } });

    const res = await callRoute(GET);
    expect(res.status).toBe(200);
    const d = DiagnosticsSchema.parse(res.json);
    expect(d.tables.map((t) => t.model).sort()).toEqual([...BACKUP_TABLES, ...EXCLUDED_TABLES].sort());
    const byModel = Object.fromEntries(d.tables.map((t) => [t.model, t]));
    expect(byModel.CardioLog).toEqual({ model: "CardioLog", label: "Kardiyo kayıtları", count: 1 });
    expect(byModel.HealthRecord).toMatchObject({ label: "Apple Sağlık kayıtları", count: 1 });
    expect(byModel.AIConversation).toMatchObject({ label: "Koç sohbetleri", count: 1 });
    // Her tablonun Türkçe adı var (yedeklenen yeni bir tabloya ad verilmezse bu test hatırlatır).
    expect(d.tables.filter((t) => t.label === `Tablo: ${t.model}`)).toEqual([]);
  });

  it("tam yolları, iki yedek klasörünün dosya sayısını, sürümü ve günlük dosyasını verir", async () => {
    const paths = getStoragePaths();
    fs.writeFileSync(path.join(paths.backupsDir, "rutinfit-backup-2026-10-30_10-00-00.json"), "{}");
    await callRoute(putAutoBackup, { method: "PUT", body: { enabled: true, folderPath: autoDir } });
    fs.writeFileSync(path.join(autoDir, "rutinfit-otomatik-yedek-2026-10-30_10-00-00.json"), "{}");
    fs.writeFileSync(path.join(autoDir, "rutinfit-otomatik-yedek-2026-10-30_11-00-00.json"), "{}");
    fs.writeFileSync(path.join(autoDir, "baska.txt"), "x");

    const d = DiagnosticsSchema.parse((await callRoute(GET)).json);
    expect(d.storage).toMatchObject({
      dataDir: paths.dataDir,
      dbPath: paths.dbPath,
      backupsDir: paths.backupsDir,
      exportsDir: path.join(paths.dataDir, "exports"),
      uploadsDir: paths.uploadsDir,
      autoBackupFolder: autoDir,
      autoBackupCount: 2,
    });
    expect(d.storage.backupCount).toBeGreaterThanOrEqual(1);
    expect(d.system.appVersion).toBe(packageJson.version);
    expect(d.system.logFile).toMatch(/com\.rutinfit\.desktop.*rutinfit\.log$/);
    expect(typeof d.system.logFileExists).toBe("boolean");
    expect(d.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
