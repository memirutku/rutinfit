import path from "node:path";
import { defineConfig } from "prisma/config";

// CLI komutları (validate, studio) için varsayılan; schema klasörüne göre prisma/dev.db.
process.env.DATABASE_URL ??= "file:./dev.db";

// package.json#prisma yerine (Prisma 7'de kaldırılıyor).
// Not: config dosyası varken Prisma CLI .env'i kendiliğinden yüklemez; CLI komutları
// DATABASE_URL'i ortamdan alır. Uygulama veritabanı yolu src/lib/storage-paths.ts'tedir.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
