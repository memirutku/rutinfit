import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPrismaClient, type PrismaClient } from "../src/lib/db/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listMigrations, runMigrations, splitSqlStatements } from "@/lib/db/migrate";

const MIGRATIONS = path.resolve(__dirname, "../prisma/migrations");
let dir: string;
let client: PrismaClient;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-migrate-"));
  client = createPrismaClient(`file:${path.join(dir, "app.db")}`);
});
afterEach(async () => {
  await client.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const tables = async () =>
  (await client.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).map((r) => r.name);
const indexes = async () =>
  (await client.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")).map((r) => r.name);

describe("splitSqlStatements", () => {
  it("yorumları atar ve ifadeleri ayırır", () => {
    expect(splitSqlStatements("-- a\nCREATE TABLE x (id int);\n\n-- b\nCREATE INDEX i ON x(id);\n")).toEqual([
      "CREATE TABLE x (id int)",
      "CREATE INDEX i ON x(id)",
    ]);
  });
});

describe("runMigrations", () => {
  it("boş veritabanını kurar, ikinci çalıştırmada hiçbir şey yapmaz", async () => {
    const first = await runMigrations(client, { migrationsDir: MIGRATIONS, backupsDir: path.join(dir, "backups") });
    expect(first.applied).toEqual(listMigrations(MIGRATIONS).map((m) => m.name));
    expect(first.backupPath).toBeUndefined(); // boş veritabanı yedeklenmez
    expect(await tables()).toContain("FoodLog");

    const second = await runMigrations(client, { migrationsDir: MIGRATIONS });
    expect(second.applied).toEqual([]);
  });

  it("db push döneminden kalan veritabanını yedekler, verisini korur, kopyaları ayıklayıp eksik indeksleri ekler", async () => {
    // Eski durum: tablolar var, izleme tablosu ve yeni indeksler yok, alışveriş listesinde kopya satır var.
    const baseline = fs.readFileSync(path.join(MIGRATIONS, "0001_init", "migration.sql"), "utf8");
    for (const stmt of splitSqlStatements(baseline)) {
      if (stmt.includes("ShoppingListItem_weekStart_name_key") || stmt.startsWith("DELETE")) continue;
      await client.$executeRawUnsafe(stmt);
    }
    await client.foodItem.create({ data: { id: "keep", name: "Yulaf", calories: 380, proteinG: 13, carbsG: 60, fatG: 7 } });
    for (let i = 0; i < 3; i++) {
      await client.$executeRawUnsafe(
        `INSERT INTO "ShoppingListItem" (id, weekStart, category, name, amount, unit, checked) VALUES ('s${i}', '2026-10-19', 'Diğer', 'Süt', 1, 'l', 0)`
      );
    }

    const result = await runMigrations(client, { migrationsDir: MIGRATIONS, backupsDir: path.join(dir, "backups") });

    expect(result.applied).toHaveLength(listMigrations(MIGRATIONS).length);
    expect(result.backupPath && fs.existsSync(result.backupPath)).toBe(true);
    expect(await client.foodItem.findUnique({ where: { id: "keep" } })).not.toBeNull();
    expect(await client.shoppingListItem.count()).toBe(1);
    expect(await indexes()).toEqual(expect.arrayContaining(["ShoppingListItem_weekStart_name_key", "FoodLog_foodItemId_idx"]));
  });
});

describe("0022: BodyMeasurement yeniden kurulumu (F16)", () => {
  it("bel ölçüsü verisi korunur, yeni alanlar boş gelir, waistCm artık isteğe bağlı", async () => {
    // 0022'den önceki migration'lar ayrı bir klasörde uygulanır, veri yazılır, sonra 0022 eklenir.
    const partial = path.join(dir, "migrations");
    for (const m of listMigrations(MIGRATIONS)) {
      if (m.name >= "0022") continue;
      fs.cpSync(path.join(MIGRATIONS, m.name), path.join(partial, m.name), { recursive: true });
    }
    await runMigrations(client, { migrationsDir: partial });
    await client.$executeRawUnsafe(`INSERT INTO "BodyMeasurement" (id, date, waistCm) VALUES ('m1', '2026-10-01', 101.5)`);

    for (const m of listMigrations(MIGRATIONS)) {
      if (m.name >= "0022") fs.cpSync(path.join(MIGRATIONS, m.name), path.join(partial, m.name), { recursive: true });
    }
    const result = await runMigrations(client, { migrationsDir: partial, backupsDir: path.join(dir, "backups") });
    expect(result.applied[0]).toMatch(/^0022_/);
    expect(await client.bodyMeasurement.findUnique({ where: { id: "m1" } })).toMatchObject({ date: "2026-10-01", waistCm: 101.5, hipCm: null, systolic: null });
    await client.bodyMeasurement.create({ data: { date: "2026-10-02", restingHr: 58 } });
    expect(await client.bodyMeasurement.count()).toBe(2);
  });
});

describe("0025: varsayılan kreatin (B02) ve takviye besin değeri (B12)", () => {
  /** 0025'ten önceki migration'ları uygular, `before` ile veri yazar, sonra kalanları uygular. */
  async function upgrade(before: () => Promise<void>) {
    const partial = path.join(dir, "migrations");
    for (const m of listMigrations(MIGRATIONS)) {
      if (m.name < "0025") fs.cpSync(path.join(MIGRATIONS, m.name), path.join(partial, m.name), { recursive: true });
    }
    await runMigrations(client, { migrationsDir: partial });
    await before();
    for (const m of listMigrations(MIGRATIONS)) fs.cpSync(path.join(MIGRATIONS, m.name), path.join(partial, m.name), { recursive: true });
    await runMigrations(client, { migrationsDir: partial });
  }

  it("yeni kurulumda takviye listesi boştur", async () => {
    await runMigrations(client, { migrationsDir: MIGRATIONS });
    expect(await client.supplement.count()).toBe(0);
  });

  it("hiç kullanılmamış varsayılan kreatin kaldırılır", async () => {
    await upgrade(async () => {
      expect(await client.supplement.count()).toBe(1);
    });
    expect(await client.supplement.count()).toBe(0);
  });

  it("kreatin kaydı ya da hatırlatması olan kullanıcının kreatini kalır; yeni alanlar boş gelir", async () => {
    await upgrade(async () => {
      await client.$executeRawUnsafe(`INSERT INTO "SupplementLog" (id, date, name, doseGrams, taken) VALUES ('l1', '2026-10-01', 'Kreatin Monohidrat', 5, 1)`);
    });
    expect(await client.supplement.findUnique({ where: { id: "default-creatine" } })).toMatchObject({ caloriesPerDose: null, proteinPerDose: null });
    expect(await client.supplementLog.findUnique({ where: { id: "l1" } })).toMatchObject({ foodLogId: null });
  });

  it("kreatin hatırlatması olan kullanıcının kreatini kalır", async () => {
    await upgrade(async () => {
      await client.$executeRawUnsafe(
        `INSERT INTO "Reminder" (id, kind, title, time, supplementId, updatedAt) VALUES ('r1', 'supplement', 'Kreatin', '09:00', 'default-creatine', 0)`
      );
    });
    expect(await client.supplement.count()).toBe(1);
  });
});

describe("migration ↔ şema uyumu", () => {
  it("prisma/migrations, schema.prisma ile birebir aynı şemayı üretir (drift yok)", () => {
    const shadow = path.join(dir, "shadow.db");
    const run = () =>
      execFileSync(
        path.resolve(__dirname, "../node_modules/.bin/prisma"),
        [
          "migrate", "diff",
          "--from-migrations", MIGRATIONS,
          "--to-schema", path.resolve(__dirname, "../prisma/schema.prisma"),
          "--exit-code",
        ],
        // Prisma 7: gölge veritabanı bayrakla değil prisma.config.ts üzerinden verilir.
        { stdio: "pipe", cwd: path.resolve(__dirname, ".."), env: { ...process.env, SHADOW_DATABASE_URL: `file:${shadow}` } }
      );
    // exit code 2 = fark var; yeni bir migration eklenmesi gerekir (bkz. README "Şema değişikliği")
    expect(run).not.toThrow();
  }, 30_000);
});
