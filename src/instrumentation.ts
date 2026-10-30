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
  // B01: ilk açılışta başlangıç kataloğu (bir kez). Hata uygulamayı durdurmaz; kullanıcı
  // boş katalogda "Başlangıç kataloğunu yükle" düğmesini görür.
  try {
    const { ensureStarterCatalog } = await import("./lib/services/starter-catalog");
    const r = await ensureStarterCatalog();
    if (r.installed) console.log(`[catalog] Başlangıç kataloğu kuruldu: ${r.foodsCreated} besin, ${r.recipesCreated} tarif.`);
  } catch (error) {
    console.error("[catalog] Başlangıç kataloğu kurulamadı:", error);
  }
  // F61: zamanı gelen otomatik yedekler sunucu açıkken alınır.
  const { startAutoBackupScheduler } = await import("./lib/services/auto-backup");
  startAutoBackupScheduler();
}
