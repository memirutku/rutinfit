import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Prisma, PrismaClient } from "../../generated/prisma/client";

export { Prisma, PrismaClient };

/**
 * Prisma 7 istemcisini better-sqlite3 sürücü adaptörüyle kurar (Rust sorgu motoru yok).
 * Uygulama, testler, seed ve E2E sunucusu istemciyi yalnız buradan oluşturur; böylece bağlantı
 * ayarları her yerde aynıdır.
 *
 * timestampFormat "unixepoch-ms": Prisma 6 (Rust motoru) DateTime alanlarını SQLite'a INTEGER
 * milisaniye olarak yazıyordu (ölçüldü: `typeof(createdAt) = 'integer'`). Mevcut kullanıcı
 * veritabanları bu biçimde; adaptörün varsayılanı ISO-8601 metindir ve eski satırlarla karışınca
 * sıralama ve karşılaştırmalar bozulur.
 */
export function createPrismaClient(
  databaseUrl: string,
  options: { log?: Prisma.LogLevel[] } = {}
): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl }, { timestampFormat: "unixepoch-ms" });
  return new PrismaClient({ adapter, log: options.log });
}
