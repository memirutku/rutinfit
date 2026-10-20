import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrismaDatabaseUrl, getStoragePaths } from "@/lib/storage-paths";

let sandbox: string;

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-paths-"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe("getStoragePaths", () => {
  it("RUTINFIT_DATA_DIR verilince tüm yolları o klasöre kurar", () => {
    vi.stubEnv("RUTINFIT_DATA_DIR", sandbox);
    const p = getStoragePaths();
    expect(p.dbPath).toBe(path.join(sandbox, "rutinfit.db"));
    expect(p.isCustomPath).toBe(true);
    expect(fs.existsSync(p.backupsDir)).toBe(true);
    expect(fs.existsSync(p.uploadsDir)).toBe(true);
    expect(getPrismaDatabaseUrl()).toBe(`file:${p.dbPath}`);
  });

  it("test ortamında RUTINFIT_DATA_DIR yoksa gerçek veritabanına gitmek yerine hata fırlatır", () => {
    vi.stubEnv("RUTINFIT_DATA_DIR", "");
    vi.stubEnv("NODE_ENV", "test");
    expect(() => getStoragePaths()).toThrow(/RUTINFIT_DATA_DIR/);
  });

  it("macOS'ta ~/Library/Application Support/RutinFit kullanır", () => {
    vi.stubEnv("RUTINFIT_DATA_DIR", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(os, "platform").mockReturnValue("darwin");
    vi.spyOn(os, "homedir").mockReturnValue(sandbox);
    vi.spyOn(process, "cwd").mockReturnValue(path.join(sandbox, "cwd"));

    const p = getStoragePaths();
    expect(p.dataDir).toBe(path.join(sandbox, "Library", "Application Support", "RutinFit"));
    expect(p.isCustomPath).toBe(false);
  });

  it("Linux'ta XDG_DATA_HOME/rutinfit kullanır", () => {
    vi.stubEnv("RUTINFIT_DATA_DIR", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("XDG_DATA_HOME", path.join(sandbox, "xdg"));
    vi.spyOn(os, "platform").mockReturnValue("linux");
    vi.spyOn(process, "cwd").mockReturnValue(path.join(sandbox, "cwd"));

    expect(getStoragePaths().dataDir).toBe(path.join(sandbox, "xdg", "rutinfit"));
  });

  it("ilk açılışta eski prisma/dev.db'yi bir kez taşır ve taşıma yedeği alır", () => {
    vi.stubEnv("RUTINFIT_DATA_DIR", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(os, "platform").mockReturnValue("darwin");
    vi.spyOn(os, "homedir").mockReturnValue(sandbox);
    const cwd = path.join(sandbox, "project");
    fs.mkdirSync(path.join(cwd, "prisma"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "prisma", "dev.db"), "legacy");
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const p = getStoragePaths();
    expect(fs.readFileSync(p.dbPath, "utf8")).toBe("legacy");
    expect(fs.readdirSync(p.backupsDir).some((f) => f.startsWith("rutinfit_migrated_"))).toBe(true);

    // İkinci çağrı mevcut DB'nin üzerine yazmaz.
    fs.writeFileSync(path.join(cwd, "prisma", "dev.db"), "changed");
    getStoragePaths();
    expect(fs.readFileSync(p.dbPath, "utf8")).toBe("legacy");
  });
});
