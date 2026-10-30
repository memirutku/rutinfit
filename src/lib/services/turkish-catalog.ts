/** F74: Türk ev yemekleri paketini kurar (tekrar çalıştırılabilir; var olanı değiştirmez). */
import { prisma } from "../prisma";
import type { Prisma } from "../db/client";
import { CATALOG_INGREDIENTS, TURKISH_DISHES } from "../turkish-catalog";

export type Tx = Prisma.TransactionClient;

export async function turkishCatalogStatus() {
  const installed = await prisma.recipe.count({ where: { name: { in: TURKISH_DISHES.map((d) => d.name) } } });
  return { dishes: TURKISH_DISHES.length, installed };
}

/** Paketi verilen transaction içinde kurar (B01: başlangıç kataloğu da bunu çağırır). */
export async function installTurkishCatalogTx(tx: Tx) {
  const foodIds = new Map<string, string>();
  let foodsCreated = 0;
  let recipesCreated = 0;
  for (const i of CATALOG_INGREDIENTS) {
    // Kullanıcının aynı adlı kaydı varsa (kendi değerleriyle) o kullanılır.
    const existing = await tx.foodItem.findFirst({ where: { name: i.name }, select: { id: true } });
    if (existing) {
      foodIds.set(i.name, existing.id);
      continue;
    }
    const { source, ...values } = i;
    const created = await tx.foodItem.create({
      data: { ...values, basisGrams: 100, source: source ?? "USDA FDC (yaklaşık)", confidence: "Yüksek" },
    });
    foodIds.set(i.name, created.id);
    foodsCreated++;
  }
  for (const dish of TURKISH_DISHES) {
    if (await tx.recipe.findFirst({ where: { name: dish.name }, select: { id: true } })) continue;
    await tx.recipe.create({
      data: {
        name: dish.name,
        servings: dish.servings,
        prepMinutes: dish.prepMinutes,
        tags: JSON.stringify(["Türk mutfağı", ...(dish.tags ?? [])]),
        instructions: `Porsiyon: ${dish.portion}. Değerler bu tarifin malzemelerinden hesaplanır; kendi tarifine göre düzenleyebilirsin.`,
        ingredients: { create: dish.ingredients.map((x) => ({ foodItemId: foodIds.get(x.name)!, grams: x.grams })) },
      },
    });
    recipesCreated++;
  }
  return { foodsCreated, recipesCreated };
}

export async function installTurkishCatalog() {
  return prisma.$transaction((tx) => installTurkishCatalogTx(tx));
}
