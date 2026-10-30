/**
 * B01: Başlangıç kataloğu. Paketli uygulama seed çalıştırmaz; kullanıcı boş katalogla açılınca
 * hızlı ekleme ve yazarak ekleme ilk öğünde çıkmaza giriyordu. Sunucu açılışında
 * (src/instrumentation.ts) temel besinler, Türk ev yemekleri paketi ve hızlı kalemler bir kez kurulur.
 *
 * "Bir kez": kurulum _rutinfit_state iç tablosuna işaret yazar. Kullanıcı sonradan bir besini
 * silerse bir sonraki açılışta geri gelmez. Kurulum ada göre yapılır; aynı adlı kayıt varsa
 * kullanıcınınki korunur. Elle kurulum (POST /api/catalog/starter) işarete bakmaz, eksikleri ekler.
 */
import { prisma } from "../prisma";
import { QUICK_FOODS } from "../quick-foods";
import { STARTER_FOODS } from "../starter-catalog";
import { installTurkishCatalogTx, type Tx } from "./turkish-catalog";

const STATE_TABLE = "_rutinfit_state";
const MARKER = "starter-catalog-v1";

export interface StarterInstallResult {
  foodsCreated: number;
  recipesCreated: number;
}

async function installTx(tx: Tx): Promise<StarterInstallResult> {
  let foodsCreated = 0;
  for (const f of STARTER_FOODS) {
    if (await tx.foodItem.findFirst({ where: { name: f.name }, select: { id: true } })) continue;
    await tx.foodItem.create({ data: { ...f, basisGrams: 100 } });
    foodsCreated++;
  }
  // Hızlı ekleme çipi (POST /api/quick-add) kalemi ad + "RutinFit" kaynağıyla arar.
  for (const q of Object.values(QUICK_FOODS)) {
    if (await tx.foodItem.findFirst({ where: { name: q.name, source: "RutinFit" }, select: { id: true } })) continue;
    await tx.foodItem.create({
      data: {
        name: q.name,
        category: q.category,
        basisGrams: q.basisGrams,
        calories: q.calories,
        proteinG: q.proteinG,
        carbsG: q.carbsG,
        fatG: q.fatG,
        source: "RutinFit",
        confidence: "Tahmini",
      },
    });
    foodsCreated++;
  }
  const turkish = await installTurkishCatalogTx(tx);
  return { foodsCreated: foodsCreated + turkish.foodsCreated, recipesCreated: turkish.recipesCreated };
}

/** Eksik başlangıç kalemlerini kurar (işarete bakmaz). */
export async function installStarterCatalog(): Promise<StarterInstallResult> {
  return prisma.$transaction((tx) => installTx(tx), { timeout: 30_000 });
}

async function ensureStateTable() {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "${STATE_TABLE}" ("key" TEXT PRIMARY KEY, "value" TEXT NOT NULL, "updatedAt" TEXT NOT NULL)`,
  );
}

/** Açılışta çağrılır: kurulum daha önce yapılmadıysa yapar ve işaretler. */
export async function ensureStarterCatalog(): Promise<StarterInstallResult & { installed: boolean }> {
  await ensureStateTable();
  const done = await prisma.$queryRawUnsafe<Array<{ value: string }>>(`SELECT "value" FROM "${STATE_TABLE}" WHERE "key" = ?`, MARKER);
  if (done.length > 0) return { installed: false, foodsCreated: 0, recipesCreated: 0 };
  const result = await installStarterCatalog();
  await prisma.$executeRawUnsafe(
    `INSERT OR REPLACE INTO "${STATE_TABLE}" ("key", "value", "updatedAt") VALUES (?, ?, ?)`,
    MARKER,
    JSON.stringify(result),
    new Date().toISOString(),
  );
  return { installed: true, ...result };
}

/** Katalog boyutu (boş katalog durumlarını göstermek için). */
export async function starterCatalogStatus() {
  const [foods, recipes] = await Promise.all([prisma.foodItem.count(), prisma.recipe.count()]);
  return { foods, recipes };
}
