import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7: bağlantı adresi şemada değil burada; yalnız CLI komutları (studio, migrate diff)
// kullanır. Uygulama veritabanı yolu src/lib/storage-paths.ts'tedir, istemci src/lib/db/client.ts.
// Config dosyası varken Prisma CLI .env'i kendiliğinden yüklemez; değerler ortamdan gelir.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Varsayılan: proje içi geliştirme veritabanı (RUTINFIT_LOCAL_DEV=true ile aynı dosya).
    url: process.env.DATABASE_URL ?? `file:${path.resolve("prisma", "dev.db")}`,
    // `migrate diff --from-migrations` için geçici gölge veritabanı (scripts/new-migration.mjs verir).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
