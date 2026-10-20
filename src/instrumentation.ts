/**
 * Next.js sunucusu açılırken bir kez çalışır: uygulama veritabanının şemasını günceller.
 * (Önceden `prisma db push` yalnız prisma/dev.db'ye uygulanıyordu; asıl uygulama veritabanı
 * şema değişikliklerini hiç almıyordu.)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.RUTINFIT_SKIP_MIGRATIONS === "true") return;
  const { runStartupMigrations } = await import("./lib/db/migrate");
  try {
    await runStartupMigrations();
  } catch (error) {
    console.error("[migrate] Veritabanı şeması güncellenemedi:", error);
    throw error;
  }
}
