import { prisma } from './prisma';
import { convertUnitAmount, normalizeUnit } from './units';
import { compareTr, normalizeName } from './text';

export { convertUnitAmount } from './units';

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

/** Kalemi bulunamayan işlemlerde fırlatılır (API 404'e çevirir). */
export class PantryItemNotFoundError extends Error {
  constructor() {
    super('Kiler öğesi bulunamadı.');
    this.name = 'PantryItemNotFoundError';
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export async function getPantryInventory() {
  const items = await prisma.pantryItem.findMany();
  // F80: Türk alfabesine göre (SQLite ikili sıralar).
  return items.sort((a, b) => compareTr(a.category, b.category) || compareTr(a.name, b.name));
}

/**
 * Kalem ekler veya günceller.
 * - id verilirse yalnız gönderilen alanlar değişir (SKT, not vb. korunur).
 * - id yoksa aynı isimli (Türkçe büyük/küçük harf duyarsız) ve birimi uyumlu kalem varsa
 *   miktar o kalemin birimine çevrilip eklenir; uyumsuz birimde ayrı kalem açılır.
 */
export async function upsertPantryItem(data: PantryItemData) {
  const { id, name, amount, unit, category, expiryDate, notes } = data;

  if (id) {
    const exists = await prisma.pantryItem.findUnique({ where: { id } });
    if (!exists) throw new PantryItemNotFoundError();
    return prisma.pantryItem.update({
      where: { id },
      data: {
        name: name.trim(),
        amount,
        ...(unit !== undefined && { unit: normalizeUnit(unit) }),
        ...(category !== undefined && { category }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate || null }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    });
  }

  const incomingUnit = normalizeUnit(unit ?? 'g');
  const key = normalizeName(name);
  const sameName = (await prisma.pantryItem.findMany()).filter((p) => normalizeName(p.name) === key);

  for (const existing of sameName) {
    const conv = convertUnitAmount(amount, incomingUnit, existing.unit);
    if (!conv.isCompatible) continue;
    return prisma.pantryItem.update({
      where: { id: existing.id },
      data: {
        amount: round(existing.amount + conv.convertedAmount),
        ...(category !== undefined && { category }),
        expiryDate: expiryDate || existing.expiryDate,
        notes: notes || existing.notes,
      },
    });
  }

  return prisma.pantryItem.create({
    data: {
      name: name.trim(),
      amount,
      unit: incomingUnit,
      category: category ?? 'Genel',
      expiryDate: expiryDate || null,
      notes: notes || null,
    },
  });
}

/**
 * Stok miktarını atomik olarak artırır/azaltır (hızlı ± tıklamalarında kayıp olmaz).
 * Sonuç sıfırın altına inmez.
 */
export async function adjustPantryAmount(id: string, delta: number) {
  return prisma.$transaction(async (tx) => {
    const exists = await tx.pantryItem.findUnique({ where: { id } });
    if (!exists) throw new PantryItemNotFoundError();
    const updated = await tx.pantryItem.update({
      where: { id },
      data: { amount: { increment: delta } },
    });
    if (updated.amount < 0) {
      return tx.pantryItem.update({ where: { id }, data: { amount: 0 } });
    }
    return updated;
  });
}

export async function deletePantryItem(id: string) {
  const res = await prisma.pantryItem.deleteMany({ where: { id } });
  if (res.count === 0) throw new PantryItemNotFoundError();
}

/**
 * Haftalık menü veya tarif gereksinimlerinden kiler stoklarını düşerek
 * net satın alınması gereken kalemleri deterministik olarak hesaplar.
 * Aynı isimli stoklar birim uyumluysa toplanır; uyumsuz birimdekiler (ör. "2 adet süt")
 * sessizce eklenmez, nota yazılır.
 */
export async function calculateNetShoppingList(
  neededIngredients: NeededIngredient[]
): Promise<NetShoppingResult> {
  const pantryItems = await getPantryInventory();
  const stockByName = new Map<string, Array<{ amount: number; unit: string }>>();
  for (const p of pantryItems) {
    const key = normalizeName(p.name);
    const list = stockByName.get(key) ?? [];
    list.push({ amount: p.amount, unit: normalizeUnit(p.unit) });
    stockByName.set(key, list);
  }

  const itemsToBuy: NetShoppingResult['itemsToBuy'] = [];
  const coveredByPantry: NetShoppingResult['coveredByPantry'] = [];

  for (const ing of neededIngredients) {
    const neededUnit = normalizeUnit(ing.unit);
    const stocks = stockByName.get(normalizeName(ing.name)) ?? [];
    const category = ing.category || 'Diğer';

    let available = 0;
    const incompatible: string[] = [];
    for (const s of stocks) {
      const conv = convertUnitAmount(s.amount, s.unit, neededUnit);
      if (conv.isCompatible) available += conv.convertedAmount;
      else if (s.amount > 0) incompatible.push(`${s.amount} ${s.unit}`);
    }

    const take = Math.min(available, ing.amount);
    // Kullanılan stoğu sonraki kalemler için düş (aynı malzeme listede birden çok kez geçebilir)
    let remainingToTake = take;
    for (const s of stocks) {
      if (remainingToTake <= 0) break;
      const conv = convertUnitAmount(s.amount, s.unit, neededUnit);
      if (!conv.isCompatible) continue;
      const used = Math.min(conv.convertedAmount, remainingToTake);
      s.amount = round(s.amount - convertUnitAmount(used, neededUnit, s.unit).convertedAmount);
      remainingToTake -= used;
    }

    const deficit = Math.round((ing.amount - take) * 10) / 10;
    const unitNote = incompatible.length
      ? ` Birim uyuşmazlığı: kilerde ${incompatible.join(', ')} var; otomatik düşülmedi.`
      : '';

    if (deficit <= 0) {
      coveredByPantry.push({ name: ing.name, amount: ing.amount, unit: neededUnit, category });
    } else {
      itemsToBuy.push({
        name: ing.name,
        amount: deficit,
        unit: neededUnit,
        category,
        neededAmount: ing.amount,
        pantryAmount: Math.round(take * 10) / 10,
        notes:
          take > 0 || unitNote
            ? `Gereken: ${ing.amount}${neededUnit}, Kilerde: ${Math.round(take * 10) / 10}${neededUnit}.${unitNote}`.trim()
            : undefined,
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
