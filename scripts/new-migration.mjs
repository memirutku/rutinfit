#!/usr/bin/env node
/**
 * schema.prisma ile mevcut migration'lar arasındaki farktan yeni bir migration üretir.
 * Kullanım: pnpm db:new-migration <kisa_ad>
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const name = (process.argv[2] || "").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
if (!name) {
  console.error("Kullanım: pnpm db:new-migration <kisa_ad>");
  process.exit(1);
}

const migrationsDir = path.join(root, "prisma", "migrations");
const existing = fs.readdirSync(migrationsDir).filter((d) => /^\d{4}_/.test(d)).sort();
const next = String((parseInt(existing.at(-1)?.slice(0, 4) ?? "0", 10) || 0) + 1).padStart(4, "0");
const shadow = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-shadow-")), "shadow.db");

// Prisma 7: --to-schema-datamodel → --to-schema; gölge veritabanı bayrak yerine
// prisma.config.ts (datasource.shadowDatabaseUrl) üzerinden verilir.
const sql = execFileSync(
  path.join(root, "node_modules", ".bin", "prisma"),
  ["migrate", "diff", "--from-migrations", migrationsDir, "--to-schema", path.join(root, "prisma", "schema.prisma"), "--script"],
  { encoding: "utf8", cwd: root, env: { ...process.env, SHADOW_DATABASE_URL: `file:${shadow}` } }
);

if (!sql.trim() || /This is an empty migration/.test(sql)) {
  console.log("Şemada değişiklik yok; migration oluşturulmadı.");
  process.exit(0);
}
const dir = path.join(migrationsDir, `${next}_${name}`);
fs.mkdirSync(dir);
fs.writeFileSync(path.join(dir, "migration.sql"), sql);
console.log(`Oluşturuldu: ${path.relative(root, dir)}/migration.sql — gözden geçirip commit'leyin.`);
