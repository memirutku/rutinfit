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
 * Standart birim dönüşüm fonksiyonu (kg <-> g, L <-> ml)
 */
export function convertUnitAmount(
  amount: number,
  fromUnit: string = 'g',
  toUnit: string = 'g'
): { convertedAmount: number; isCompatible: boolean } {
  const from = fromUnit.toLowerCase().trim();
  const to = toUnit.toLowerCase().trim();

  if (from === to) {
    return { convertedAmount: amount, isCompatible: true };
  }

  // Ağırlık dönüşümleri: kg <-> g
  if (from === 'kg' && (to === 'g' || to === 'gr')) {
    return { convertedAmount: amount * 1000, isCompatible: true };
  }
  if ((from === 'g' || from === 'gr') && to === 'kg') {
    return { convertedAmount: amount / 1000, isCompatible: true };
  }

  // Hacim dönüşümleri: l/lt/litre <-> ml
  if ((from === 'l' || from === 'lt' || from === 'litre' || from === 'liter') && to === 'ml') {
    return { convertedAmount: amount * 1000, isCompatible: true };
  }
  if (from === 'ml' && (to === 'l' || to === 'lt' || to === 'litre' || to === 'liter')) {
    return { convertedAmount: amount / 1000, isCompatible: true };
  }

  return { convertedAmount: amount, isCompatible: false };
}

/**
 * Haftalık menü veya tarif gereksinimlerinden kiler stoklarını düşerek
 * net satın alınması gereken kalemleri deterministik olarak hesaplar.
 */
export async function calculateNetShoppingList(
  neededIngredients: NeededIngredient[]
): Promise<NetShoppingResult> {
  const pantryItems = await getPantryInventory();
  // Malzeme adı -> { amount: number, unit: string }
  const pantryMap = new Map<string, { amount: number; unit: string }>();

  for (const p of pantryItems) {
    const key = p.name.toLowerCase().trim();
    const existing = pantryMap.get(key);
    if (!existing) {
      pantryMap.set(key, { amount: p.amount, unit: p.unit || 'g' });
    } else {
      // Mevcut stok ile aynı birimdeyse topla
      const conv = convertUnitAmount(p.amount, p.unit || 'g', existing.unit);
      if (conv.isCompatible) {
        existing.amount += conv.convertedAmount;
      } else {
        // Uyuşmuyorsa miktarı doğrudan topla
        existing.amount += p.amount;
      }
    }
  }

  const itemsToBuy: NetShoppingResult['itemsToBuy'] = [];
  const coveredByPantry: NetShoppingResult['coveredByPantry'] = [];

  for (const ing of neededIngredients) {
    const key = ing.name.toLowerCase().trim();
    const stockItem = pantryMap.get(key);

    if (!stockItem || stockItem.amount <= 0) {
      // Kilerde hiç yok
      itemsToBuy.push({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        category: ing.category || 'Diğer',
        neededAmount: ing.amount,
        pantryAmount: 0,
      });
      continue;
    }

    // Birim dönüşümünü kontrol et
    const { convertedAmount: stockInNeededUnit, isCompatible } = convertUnitAmount(
      stockItem.amount,
      stockItem.unit,
      ing.unit
    );

    if (!isCompatible) {
      // Birimler uyuşmuyor (örn. adet vs g)
      itemsToBuy.push({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        category: ing.category || 'Diğer',
        neededAmount: ing.amount,
        pantryAmount: stockItem.amount,
        notes: `Birim uyuşmazlığı: Kilerde ${stockItem.amount} ${stockItem.unit}, Tarifte ${ing.amount} ${ing.unit}. Otomatik çıkarma yapılmadı.`,
      });
      continue;
    }

    if (stockInNeededUnit >= ing.amount) {
      // Tamamen kiler stoklarından karşılanıyor
      coveredByPantry.push({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        category: ing.category || 'Diğer',
      });
      // Kalan stoğu düş
      const remainingNeededUnit = stockInNeededUnit - ing.amount;
      const backConv = convertUnitAmount(remainingNeededUnit, ing.unit, stockItem.unit);
      stockItem.amount = backConv.convertedAmount;
    } else {
      // Kısmi karşılama
      const deficit = Math.round((ing.amount - stockInNeededUnit) * 10) / 10;
      itemsToBuy.push({
        name: ing.name,
        amount: deficit,
        unit: ing.unit,
        category: ing.category || 'Diğer',
        neededAmount: ing.amount,
        pantryAmount: Math.round(stockInNeededUnit * 10) / 10,
        notes: `Gereken: ${ing.amount}${ing.unit}, Kilerde: ${Math.round(stockInNeededUnit * 10) / 10}${ing.unit}`,
      });
      stockItem.amount = 0;
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
