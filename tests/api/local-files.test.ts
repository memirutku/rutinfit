import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Testler gerçek Finder ya da klasör seçme penceresi açmasın: execFile sahtelenir.
const execFile = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile, default: { execFile } }));

import { POST as reveal } from "@/app/api/system/reveal/route";
import { POST as chooseFolder } from "@/app/api/system/choose-folder/route";
import { GET as exportBackup } from "@/app/api/backup/export/route";
import { GET as exportCsv } from "@/app/api/export/csv/route";
import { PUT as putAutoBackup, GET as getAutoBackup } from "@/app/api/backup/auto/route";
import { localFileStamp, saveExportCopy } from "@/lib/services/export-files";
import { runAutoBackup } from "@/lib/services/auto-backup";
import { getStoragePaths } from "@/lib/storage-paths";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

type Callback = (error: (Error & { code?: number }) | null, stdout: string, stderr: string) => void;
const answer = (stdout: string, error: (Error & { code?: number }) | null = null, stderr = "") =>
  execFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Callback) => cb(error, stdout, stderr));

const realPlatform = process.platform;
const setPlatform = (p: NodeJS.Platform) => Object.defineProperty(process, "platform", { value: p });
const realHome = process.env.HOME;
const realTz = process.env.RUTINFIT_TIMEZONE;
let home: string;
let outside: string;

beforeEach(async () => {
  await resetDatabase();
  execFile.mockReset();
  answer("");
  setPlatform("darwin");
  home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-home-")));
  fs.mkdirSync(path.join(home, "Downloads"));
  process.env.HOME = home;
  outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-outside-")));
});
afterEach(() => {
  setPlatform(realPlatform);
  process.env.HOME = realHome;
  if (realTz === undefined) delete process.env.RUTINFIT_TIMEZONE;
  else process.env.RUTINFIT_TIMEZONE = realTz;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});
afterAll(() => setPlatform(realPlatform));

const revealCall = (body: unknown) => callRoute(reveal, { method: "POST", body });
const exportsFile = (name: string) => {
  const dir = path.join(getStoragePaths().dataDir, "exports");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, "x");
  return fs.realpathSync(file);
};

describe("B36: Finder'da göster", () => {
  it("uygulama klasöründeki dosyayı kabuksuz 'open -R' ile gösterir", async () => {
    const file = exportsFile("rutinfit-yemek.csv");
    const res = await revealCall({ path: file });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, path: file });
    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile.mock.calls[0][0]).toBe("/usr/bin/open");
    expect(execFile.mock.calls[0][1]).toEqual(["-R", file]);
  });

  it("izinli kökler dışındaki, göreli, olmayan ya da dışarıyı gösteren bağlantı reddedilir", async () => {
    const secret = path.join(outside, "gizli.txt");
    fs.writeFileSync(secret, "x");
    expect((await revealCall({ path: secret })).status).toBe(403);
    expect((await revealCall({ path: "exports/a.csv" })).status).toBe(400);
    expect((await revealCall({ path: path.join(getStoragePaths().dataDir, "yok.json") })).status).toBe(404);
    // Uygulama klasörü içinden dışarıya giden sembolik bağlantı da dışarıda sayılır.
    const link = path.join(getStoragePaths().dataDir, "kacis");
    fs.symlinkSync(outside, link);
    expect((await revealCall({ path: path.join(link, "gizli.txt") })).status).toBe(403);
    expect((await revealCall({ path: `${getStoragePaths().dataDir}/../${path.basename(outside)}/gizli.txt` })).status).toBe(403);
    expect(execFile).not.toHaveBeenCalled();
  });

  it("indirilen dosya İndirilenler'de gösterilir; dosya yoksa klasör açılır; yol parçası kabul edilmez", async () => {
    fs.writeFileSync(path.join(home, "Downloads", "rutinfit-backup-2026-10-30_16-57-24.json"), "{}");
    const found = await revealCall({ download: "rutinfit-backup-2026-10-30_16-57-24.json" });
    expect(found.status).toBe(200);
    expect(execFile.mock.calls[0][1]).toEqual(["-R", path.join(home, "Downloads", "rutinfit-backup-2026-10-30_16-57-24.json")]);

    const missing = await revealCall({ download: "baska.json" });
    expect(missing.json).toEqual({ ok: true, path: path.join(home, "Downloads") });
    expect((await revealCall({ download: "../.ssh/id_rsa" })).status).toBe(400);
    expect((await revealCall({})).status).toBe(400);
  });

  it("seçilen otomatik yedek klasörü de izinli köktür", async () => {
    fs.writeFileSync(path.join(outside, "rutinfit-otomatik-yedek-1.json"), "{}");
    expect((await callRoute(putAutoBackup, { method: "PUT", body: { enabled: true, folderPath: outside } })).status).toBe(200);
    expect((await revealCall({ path: path.join(outside, "rutinfit-otomatik-yedek-1.json") })).status).toBe(200);
  });

  it("macOS dışında Windows Gezgini; komut hata verirse anlaşılır hata döner", async () => {
    const file = exportsFile("a.csv");
    setPlatform("win32");
    await revealCall({ path: file });
    expect(execFile.mock.calls[0][0]).toBe("explorer.exe");
    expect(execFile.mock.calls[0][1]).toEqual([`/select,${file}`]);

    setPlatform("darwin");
    answer("", Object.assign(new Error("open failed"), { code: 1 }));
    const res = await revealCall({ path: file });
    expect(res.status).toBe(500);
    expect(res.json.error).toMatch(/Finder/);
  });
});

describe("B36: klasör seçme penceresi (macOS osascript)", () => {
  it("seçilen klasörü sonundaki eğik çizgi olmadan döndürür; istem metni betiğe gömülmez, argüman olarak geçer", async () => {
    answer("/Users/ben/Library/Mobile Documents/com~apple~CloudDocs/RutinFit/\n");
    const res = await callRoute(chooseFolder, { method: "POST", body: {} });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ path: "/Users/ben/Library/Mobile Documents/com~apple~CloudDocs/RutinFit" });
    const [cmd, args] = execFile.mock.calls[0];
    expect(cmd).toBe("/usr/bin/osascript");
    const script = args.slice(0, args.indexOf("--")).join("\n");
    expect(script).toContain("choose folder");
    expect(script).not.toContain("RutinFit yedek");
    expect(args.slice(args.indexOf("--") + 1)[0]).toMatch(/yedek/i);
  });

  it("kullanıcı vazgeçerse path null; başka hata 500; macOS dışında 501", async () => {
    answer("", Object.assign(new Error("Command failed"), { code: 1 }), "execution error: User canceled. (-128)");
    expect((await callRoute(chooseFolder, { method: "POST", body: {} })).json).toEqual({ path: null });

    answer("", Object.assign(new Error("Command failed"), { code: 1 }), "execution error: boom");
    expect((await callRoute(chooseFolder, { method: "POST", body: {} })).status).toBe(500);

    setPlatform("linux");
    const res = await callRoute(chooseFolder, { method: "POST", body: {} });
    expect(res.status).toBe(501);
    expect(res.json.error).toMatch(/elle/);
  });
});

describe("B36: dışa aktarma kopyası ayarı ve yerel saatli dosya adları", () => {
  it("yerel saat damgası: UTC değil uygulama saat dilimi", () => {
    process.env.RUTINFIT_TIMEZONE = "Europe/Istanbul";
    expect(localFileStamp(new Date("2026-10-30T13:57:24.738Z"))).toBe("2026-10-30_16-57-24");
    process.env.RUTINFIT_TIMEZONE = "America/New_York";
    expect(localFileStamp(new Date("2026-10-30T02:05:09Z"))).toBe("2026-10-29_22-05-09");
  });

  it("varsayılan açık: yedek ve CSV kopyası yazılır, indirilen adla aynı yerel saatli ad kullanılır", async () => {
    const res = await callRoute(exportBackup);
    const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition")!)![1];
    expect(name).toMatch(/^rutinfit-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/);
    const copy = decodeURIComponent(res.headers.get("x-rutinfit-backup-path")!);
    expect(path.basename(copy)).toBe(name);
    expect(fs.existsSync(copy)).toBe(true);
    expect((await callRoute(getAutoBackup)).json.exportCopies).toBe(true);
    expect((await callRoute(exportCsv, { query: { type: "body" } })).headers.get("x-rutinfit-export-path")).toBeTruthy();
  });

  it("kapatılınca hiçbir dışa aktarma uygulama klasörüne kopya yazmaz", async () => {
    const put = await callRoute(putAutoBackup, { method: "PUT", body: { exportCopies: false } });
    expect(put.json.exportCopies).toBe(false);
    const exportsDir = path.join(getStoragePaths().dataDir, "exports");
    const before = fs.existsSync(exportsDir) ? fs.readdirSync(exportsDir).length : 0;
    const backups = fs.readdirSync(getStoragePaths().backupsDir).length;

    const json = await callRoute(exportBackup);
    expect(json.status).toBe(200);
    expect(json.headers.get("x-rutinfit-backup-path")).toBeNull();
    const csv = await callRoute(exportCsv, { query: { type: "body" } });
    expect(csv.headers.get("x-rutinfit-export-path")).toBeNull();
    expect(await saveExportCopy("x", "rapor.xlsx")).toBeNull();
    expect(fs.existsSync(exportsDir) ? fs.readdirSync(exportsDir).length : 0).toBe(before);
    expect(fs.readdirSync(getStoragePaths().backupsDir)).toHaveLength(backups);
  });

  it("otomatik yedek dosya adı yerel saatlidir; aynı saniyedeki ikinci yedek üzerine yazmaz", async () => {
    process.env.RUTINFIT_TIMEZONE = "Europe/Istanbul";
    await callRoute(putAutoBackup, { method: "PUT", body: { enabled: true, folderPath: outside, keepCount: 5 } });
    const now = new Date("2026-10-30T13:57:24.738Z");
    const first = await runAutoBackup(now);
    const second = await runAutoBackup(now);
    expect(path.basename(first.file!)).toBe("rutinfit-otomatik-yedek-2026-10-30_16-57-24.json");
    expect(second.file).not.toBe(first.file);
    expect(fs.readdirSync(outside).sort()).toEqual(["rutinfit-otomatik-yedek-2026-10-30_16-57-24.json", "rutinfit-otomatik-yedek-2026-10-30_16-57-24_2.json"]);
  });
});
