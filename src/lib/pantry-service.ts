import { prisma } from './prisma';

export interface PantryItemData {
  id?: string;
  name: string;
  amount: number;
  unit?: string;
  category?: string;
  expiryDate?: string | null;
  notes?: string | null;
}

export interface NeededIngredient {
  name: string;
  amount: number;
  unit: string;
  category?: string;
}

export interface NetShoppingResult {
  itemsToBuy: Array<{
    name: string;
    amount: number;
    unit: string;
    category: string;
    neededAmount: number;
    pantryAmount: number;
    notes?: string;
  }>;
  coveredByPantry: Array<{
    name: string;
    amount: number;
    unit: string;
    category: string;
  }>;
  totalPlanned: number;
  totalToBuy: number;
  totalCovered: number;
  summary: string;
}

export async function getPantryInventory() {
  return prisma.pantryItem.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

export async function upsertPantryItem(data: PantryItemData) {
  const { id, name, amount, unit = 'g', category = 'Genel', expiryDate, notes } = data;

  if (id) {
    return prisma.pantryItem.update({
      where: { id },
      data: {
        name,
        amount: Number(amount) || 0,
        unit,
        category,
        expiryDate: expiryDate || null,
        notes: notes || null,
      },
    });
  }

  // Check if item with same name exists
  const existing = await prisma.pantryItem.findFirst({
    where: { name: { equals: name } },
  });

  if (existing) {
    return prisma.pantryItem.update({
      where: { id: existing.id },
      data: {
        amount: existing.amount + (Number(amount) || 0),
        unit,
        category,
        expiryDate: expiryDate || existing.expiryDate,
        notes: notes || existing.notes,
      },
    });
  }

  return prisma.pantryItem.create({
    data: {
      name,
      amount: Number(amount) || 0,
      unit,
      category,
      expiryDate: expiryDate || null,
      notes: notes || null,
    },
  });
}

export async function deletePantryItem(id: string) {
  return prisma.pantryItem.delete({
    where: { id },
  });
}

/**
 * Haftalık menü veya tarif gereksinimlerinden kiler stoklarını düşerek
 * net satın alınması gereken kalemleri deterministik olarak hesaplar.
 */
export async function calculateNetShoppingList(
  neededIngredients: NeededIngredient[]
): Promise<NetShoppingResult> {
  const pantryItems = await getPantryInventory();
  const pantryMap = new Map<string, number>();

  for (const p of pantryItems) {
    const key = p.name.toLowerCase().trim();
    pantryMap.set(key, (pantryMap.get(key) || 0) + p.amount);
  }

  const itemsToBuy: NetShoppingResult['itemsToBuy'] = [];
  const coveredByPantry: NetShoppingResult['coveredByPantry'] = [];

  for (const ing of neededIngredients) {
    const key = ing.name.toLowerCase().trim();
    const inStock = pantryMap.get(key) || 0;

    if (inStock >= ing.amount) {
      // Tamamen kiler stoklarından karşılanıyor
      coveredByPantry.push({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        category: ing.category || 'Diğer',
      });
      // Kalan sanal stoğu düş (aynı malzeme başka öğünde de istenirse)
      pantryMap.set(key, inStock - ing.amount);
    } else if (inStock > 0) {
      // Kısmi karşılama
      const deficit = Math.round((ing.amount - inStock) * 10) / 10;
      itemsToBuy.push({
        name: ing.name,
        amount: deficit,
        unit: ing.unit,
        category: ing.category || 'Diğer',
        neededAmount: ing.amount,
        pantryAmount: inStock,
        notes: `Gereken: ${ing.amount}${ing.unit}, Kilerde: ${inStock}${ing.unit}`,
      });
      pantryMap.set(key, 0);
    } else {
      // Kilerde hiç yok
      itemsToBuy.push({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        category: ing.category || 'Diğer',
        neededAmount: ing.amount,
        pantryAmount: 0,
      });
    }
  }

  const summary = [
    `Planlanan ${neededIngredients.length} malzemeden ${coveredByPantry.length} tanesi kilerinizden karşılandı.`,
    itemsToBuy.length > 0
      ? `Alışveriş listesine ${itemsToBuy.length} kalem eksik malzeme eklendi.`
      : 'Tüm malzemeler kilerinizde mevcut, yeni alışverişe gerek yok!',
  ].join(' ');

  return {
    itemsToBuy,
    coveredByPantry,
    totalPlanned: neededIngredients.length,
    totalToBuy: itemsToBuy.length,
    totalCovered: coveredByPantry.length,
    summary,
  };
}
