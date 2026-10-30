import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST, PUT } from "@/app/api/backup/auto/route";
import { isAutoBackupDue } from "@/lib/services/auto-backup";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

let dir: string;
beforeEach(async () => {
  await resetDatabase();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-auto-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const ours = () => fs.readdirSync(dir).filter((f) => f.startsWith("rutinfit-otomatik-yedek-"));

describe("F61: otomatik yedek zamanlaması", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  it("kapalıyken ya da klasör yokken hiç; hiç çalışmamışsa hemen; sonra günlük/haftalık aralıkla", () => {
    expect(isAutoBackupDue({ enabled: false, folderPath: dir, frequency: "daily", lastRunAt: null }, now)).toBe(false);
    expect(isAutoBackupDue({ enabled: true, folderPath: null, frequency: "daily", lastRunAt: null }, now)).toBe(false);
    expect(isAutoBackupDue({ enabled: true, folderPath: dir, frequency: "daily", lastRunAt: null }, now)).toBe(true);
    expect(isAutoBackupDue({ enabled: true, folderPath: dir, frequency: "daily", lastRunAt: new Date("2026-10-29T13:00:00Z") }, now)).toBe(false);
    expect(isAutoBackupDue({ enabled: true, folderPath: dir, frequency: "daily", lastRunAt: new Date("2026-10-29T11:00:00Z") }, now)).toBe(true);
    expect(isAutoBackupDue({ enabled: true, folderPath: dir, frequency: "weekly", lastRunAt: new Date("2026-10-25T12:00:00Z") }, now)).toBe(false);
  });
});

describe("/api/backup/auto", () => {
  it("varsayılan: kapalı, önerilen klasör Belgeler altında", async () => {
    const res = await callRoute(GET);
    expect(res.json).toMatchObject({ enabled: false, frequency: "daily", keepCount: 10, folderPath: null });
    expect(res.json.suggestedFolder).toMatch(/RutinFit Yedekleri$/);
  });

  it("açarken klasör doğrulanır: göreli yol 400; olmayan klasör (üstü varsa) oluşturulur", async () => {
    expect((await callRoute(PUT, { method: "PUT", body: { enabled: true, folderPath: "yedekler" } })).status).toBe(400);
    const nested = path.join(dir, "Yedekler");
    const res = await callRoute(PUT, { method: "PUT", body: { enabled: true, folderPath: nested, frequency: "weekly", keepCount: 3 } });
    expect(res.status).toBe(200);
    expect(fs.existsSync(nested)).toBe(true);
    expect(res.json).toMatchObject({ enabled: true, folderPath: nested, frequency: "weekly", keepCount: 3 });
  });

  it("şimdi yedekle: geçerli bir yedek dosyası yazar, durumu kaydeder; saklama sayısını aşan eskiler silinir, başka dosyalara dokunulmaz", async () => {
    fs.writeFileSync(path.join(dir, "notlarim.txt"), "x");
    await callRoute(PUT, { method: "PUT", body: { enabled: true, folderPath: dir, keepCount: 2 } });
    for (let i = 0; i < 3; i++) {
      const res = await callRoute(POST, { method: "POST" });
      expect(res.status).toBe(200);
      expect(res.json.ok).toBe(true);
    }
    expect(ours()).toHaveLength(2);
    expect(fs.existsSync(path.join(dir, "notlarim.txt"))).toBe(true);
    const latest = JSON.parse(fs.readFileSync(path.join(dir, ours().sort().at(-1)!), "utf8"));
    expect(latest.version).toBe("2.0");
    const settings = (await callRoute(GET)).json;
    expect(settings).toMatchObject({ lastStatus: "ok" });
    expect(settings.lastFile).toContain(dir);
  });

  it("klasör sonradan silinirse yedek hata olarak kaydedilir", async () => {
    await callRoute(PUT, { method: "PUT", body: { enabled: true, folderPath: dir } });
    fs.rmSync(dir, { recursive: true, force: true });
    const res = await callRoute(POST, { method: "POST" });
    expect(res.status).toBe(422);
    expect(res.json.ok).toBe(false);
    expect((await prisma.autoBackupSettings.findFirstOrThrow()).lastStatus).toBe("error");
  });
});
