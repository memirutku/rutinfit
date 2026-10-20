/**
 * Bekleyen migration'ları uygulama veritabanına uygular (src/lib/storage-paths.ts ile aynı konum:
 * RUTINFIT_DATA_DIR → RUTINFIT_LOCAL_DEV=true ise prisma/dev.db → işletim sistemi veri klasörü).
 * Kullanım: pnpm db:migrate
 */
import { runStartupMigrations } from "../src/lib/db/migrate";
import { getStoragePaths } from "../src/lib/storage-paths";

async function main() {
  console.log(`Veritabanı: ${getStoragePaths().dbPath}`);
  const { applied, backupPath } = await runStartupMigrations();
  console.log(applied.length ? `Uygulandı: ${applied.join(", ")}` : "Şema güncel; bekleyen migration yok.");
  if (backupPath) console.log(`Öncesinde yedek alındı: ${backupPath}`);
  const { prisma } = await import("../src/lib/prisma");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
