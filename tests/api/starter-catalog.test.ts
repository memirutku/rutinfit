import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/catalog/starter/route";
import { prisma } from "@/lib/prisma";
import { ensureStarterCatalog } from "@/lib/services/starter-catalog";
import { STARTER_FOODS } from "@/lib/starter-catalog";
import { TURKISH_DISHES } from "@/lib/turkish-catalog";
import { QUICK_FOODS } from "@/lib/quick-foods";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood } from "../helpers/factories";

/** Kurulum işareti _rutinfit_ önekli iç tabloda durur; resetDatabase onu silmez. */
async function freshInstall() {
  await resetDatabase();
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "_rutinfit_state"`);
}

beforeEach(freshInstall);

describe("B01: ilk açılışta başlangıç kataloğu", () => {
  it("boş veritabanına temel besinleri, Türk ev yemeklerini ve hızlı kalemleri kurar", async () => {
    expect(await prisma.foodItem.count()).toBe(0);
    const res = await ensureStarterCatalog();
    expect(res.installed).toBe(true);
    expect(res.recipesCreated).toBe(TURKISH_DISHES.length);

    for (const f of STARTER_FOODS) expect(await prisma.foodItem.count({ where: { name: f.name } })).toBe(1);
    expect(await prisma.recipe.findFirst({ where: { name: "Mercimek Çorbası" } })).not.toBeNull();
    for (const q of Object.values(QUICK_FOODS)) {
      // Hızlı ekleme çipi aynı kaydı bulur (ad + kaynak "RutinFit").
      expect(await prisma.foodItem.count({ where: { name: q.name, source: "RutinFit" } })).toBe(1);
    }
  });

  it("yalnız bir kez çalışır; kullanıcının sildiği besin geri gelmez", async () => {
    await ensureStarterCatalog();
    const before = await prisma.foodItem.count();
    await prisma.foodItem.deleteMany({ where: { name: "Muz" } });

    const again = await ensureStarterCatalog();
    expect(again).toEqual({ installed: false, foodsCreated: 0, recipesCreated: 0 });
    expect(await prisma.foodItem.count({ where: { name: "Muz" } })).toBe(0);
    expect(await prisma.foodItem.count()).toBe(before - 1);
  });

  it("aynı adlı kullanıcı besinini çoğaltmaz, onu kullanır", async () => {
    const mine = await createFood({ name: "Domates", calories: 21 });
    await ensureStarterCatalog();
    expect(await prisma.foodItem.count({ where: { name: "Domates" } })).toBe(1);
    const menemen = await prisma.recipe.findFirstOrThrow({ where: { name: "Menemen" }, include: { ingredients: true } });
    expect(menemen.ingredients.some((i) => i.foodItemId === mine.id)).toBe(true);
  });
});

describe("/api/catalog/starter", () => {
  it("GET katalog boyutunu verir; POST eksikleri kurar (işaretten bağımsız, elle)", async () => {
    expect((await callRoute(GET)).json).toEqual({ foods: 0, recipes: 0 });

    const first = await callRoute(POST, { method: "POST" });
    expect(first.status).toBe(201);
    expect(first.json.foodsCreated).toBeGreaterThan(STARTER_FOODS.length);
    expect(first.json.recipesCreated).toBe(TURKISH_DISHES.length);
    const status = (await callRoute(GET)).json;
    expect(status.foods).toBeGreaterThan(0);
    expect(status.recipes).toBe(TURKISH_DISHES.length);

    expect((await callRoute(POST, { method: "POST" })).json).toEqual({ foodsCreated: 0, recipesCreated: 0 });
  });
});
