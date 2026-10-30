import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "./client";

/**
 * Uygulama içi migration uygulayıcı.
 *
 * Paketlenmiş masaüstü uygulamasında Prisma CLI bulunmaz; şema değişiklikleri sunucu açılırken
 * (src/instrumentation.ts) buradan uygulanır. prisma/migrations/<ad>/migration.sql dosyaları ad
 * sırasıyla, her biri kendi transaction'ında çalıştırılır ve _rutinfit_migrations tablosuna yazılır.
 * Bekleyen migration varsa ve veritabanı boş değilse önce tutarlı bir yedek alınır (VACUUM INTO).
 */

export interface MigrationResult {
  applied: string[];
  backupPath?: string;
}

interface Options {
  migrationsDir: string;
  backupsDir?: string;
  log?: (message: string) => void;
}

const TRACKING_TABLE = "_rutinfit_migrations";

/** SQL dosyasını tek tek ifadelere böler (Prisma'nın raw sorgusu tek ifade çalıştırır). */
export function splitSqlStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return withoutComments
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function listMigrations(migrationsDir: string): Array<{ name: string; sql: string; checksum: string }> {
  // turbopackIgnore: klasör çalışma anında verilir; dosyalar pakete next.config.mjs
  // (outputFileTracingIncludes) ile girer. Yorum olmadan izleyici projedeki her migration.sql'i
  // (src-tauri altındaki eski kopyalar dahil) pakete katar.
  if (!fs.existsSync(/*turbopackIgnore: true*/ migrationsDir)) return [];
  return fs
    .readdirSync(/*turbopackIgnore: true*/ migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(/*turbopackIgnore: true*/ migrationsDir, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(/*turbopackIgnore: true*/ migrationsDir, name, "migration.sql"), "utf8");
      return { name, sql, checksum: crypto.createHash("sha256").update(sql).digest("hex") };
    });
}

export async function runMigrations(client: PrismaClient, opts: Options): Promise<MigrationResult> {
  const log = opts.log ?? (() => {});
  await client.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "${TRACKING_TABLE}" ("name" TEXT PRIMARY KEY, "checksum" TEXT NOT NULL, "appliedAt" TEXT NOT NULL)`
  );

  const applied = new Map(
    (await client.$queryRawUnsafe<Array<{ name: string; checksum: string }>>(`SELECT "name", "checksum" FROM "${TRACKING_TABLE}"`)).map(
      (r) => [r.name, r.checksum]
    )
  );
  const all = listMigrations(opts.migrationsDir);
  for (const m of all) {
    const known = applied.get(m.name);
    if (known && known !== m.checksum) log(`[migrate] Uyarı: uygulanmış ${m.name} dosyası sonradan değişmiş.`);
  }
  const pending = all.filter((m) => !applied.has(m.name));
  if (pending.length === 0) return { applied: [] };

  let backupPath: string | undefined;
  const userTables = await client.$queryRawUnsafe<Array<{ n: number | bigint }>>(
    `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '${TRACKING_TABLE}'`
  );
  if (opts.backupsDir && Number(userTables[0]?.n ?? 0) > 0) {
    fs.mkdirSync(/*turbopackIgnore: true*/ opts.backupsDir, { recursive: true });
    backupPath = path.join(/*turbopackIgnore: true*/ opts.backupsDir, `rutinfit_pre-migration_${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
    await client.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
    log(`[migrate] Migration öncesi yedek: ${backupPath}`);
  }

  for (const m of pending) {
    const statements = splitSqlStatements(m.sql);
    await client.$transaction([
      ...statements.map((stmt) => client.$executeRawUnsafe(stmt)),
      client.$executeRawUnsafe(
        `INSERT INTO "${TRACKING_TABLE}" ("name", "checksum", "appliedAt") VALUES (?, ?, ?)`,
        m.name,
        m.checksum,
        new Date().toISOString()
      ),
    ]);
    log(`[migrate] Uygulandı: ${m.name} (${statements.length} ifade)`);
  }
  return { applied: pending.map((m) => m.name), backupPath };
}

/** Paketli uygulamada migration klasörü sunucu dizinindedir; ortam değişkeniyle değiştirilebilir. */
export function defaultMigrationsDir(): string {
  return process.env.RUTINFIT_MIGRATIONS_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "prisma", "migrations");
}

/** Sunucu açılışında uygulama veritabanına bekleyen migration'ları uygular. */
export async function runStartupMigrations(): Promise<MigrationResult> {
  const [{ prisma }, { getStoragePaths }] = await Promise.all([import("../prisma"), import("../storage-paths")]);
  return runMigrations(prisma, {
    migrationsDir: defaultMigrationsDir(),
    backupsDir: getStoragePaths().backupsDir,
    log: (m) => console.log(m),
  });
}
