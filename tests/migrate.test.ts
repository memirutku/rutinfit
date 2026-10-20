import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listMigrations, runMigrations, splitSqlStatements } from "@/lib/db/migrate";

const MIGRATIONS = path.resolve(__dirname, "../prisma/migrations");
let dir: string;
let client: PrismaClient;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-migrate-"));
  client = new PrismaClient({ datasourceUrl: `file:${path.join(dir, "app.db")}` });
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

describe("migration ↔ şema uyumu", () => {
  it("prisma/migrations, schema.prisma ile birebir aynı şemayı üretir (drift yok)", () => {
    const shadow = path.join(dir, "shadow.db");
    const run = () =>
      execFileSync(
        path.resolve(__dirname, "../node_modules/.bin/prisma"),
        [
          "migrate", "diff",
          "--from-migrations", MIGRATIONS,
          "--to-schema-datamodel", path.resolve(__dirname, "../prisma/schema.prisma"),
          "--shadow-database-url", `file:${shadow}`,
          "--exit-code",
        ],
        { stdio: "pipe" }
      );
    // exit code 2 = fark var; yeni bir migration eklenmesi gerekir (bkz. README "Şema değişikliği")
    expect(run).not.toThrow();
  }, 30_000);
});
