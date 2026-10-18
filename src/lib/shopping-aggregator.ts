export interface PlannedRecipeItem {
  recipeName: string;
  servings: number;
  ingredients: {
    name: string;
    category: string;
    grams: number;
  }[];
}

export interface AggregatedShoppingItem {
  name: string;
  category: string;
  totalGrams: number;
  formattedAmount: string;
}

const CATEGORY_MAP: Record<string, string> = {
  manav: "Manav (Sebze & Meyve)",
  kasap: "Kasap & Balık",
  sut: "Süt Ürünleri & Yumurta",
  tahil: "Kuru Gıda & Tahıllar",
  bakliyat: "Bakliyatlar",
  yag: "Yağlar & Soslar",
  diger: "Diğer",
};

export function resolveShoppingCategory(categoryOrFoodName: string): string {
  const lower = categoryOrFoodName.toLowerCase().trim();

  // Doğrudan anahtar kontrolü
  if (CATEGORY_MAP[lower]) {
    return CATEGORY_MAP[lower];
  }

  // Değer kontrolü (zaten tam kategori adı verilmişse)
  for (const catVal of Object.values(CATEGORY_MAP)) {
    if (lower === catVal.toLowerCase()) return catVal;
  }

  if (
    lower.includes("manav") ||
    lower.includes("muz") ||
    lower.includes("elma") ||
    lower.includes("ıspanak") ||
    lower.includes("domates") ||
    lower.includes("salatalık") ||
    lower.includes("biber") ||
    lower.includes("marul") ||
    lower.includes("patates") ||
    lower.includes("meyve") ||
    lower.includes("sebze")
  ) {
    return CATEGORY_MAP.manav;
  }

  if (
    lower.includes("kasap") ||
    lower.includes("tavuk") ||
    lower.includes("kıyma") ||
    lower.includes("et") ||
    lower.includes("hindi") ||
    lower.includes("ton") ||
    lower.includes("somon") ||
    lower.includes("balık")
  ) {
    return CATEGORY_MAP.kasap;
  }

  if (
    lower.includes("süt") ||
    lower.includes("sut") ||
    lower.includes("yumurta") ||
    lower.includes("yoğurt") ||
    lower.includes("lor") ||
    lower.includes("peynir")
  ) {
    return CATEGORY_MAP.sut;
  }

  if (
    lower.includes("tahıl") ||
    lower.includes("tahil") ||
    lower.includes("yulaf") ||
    lower.includes("pirinç") ||
    lower.includes("bulgur") ||
    lower.includes("ekmek") ||
    lower.includes("makarna")
  ) {
    return CATEGORY_MAP.tahil;
  }

  if (
    lower.includes("bakliyat") ||
    lower.includes("mercimek") ||
    lower.includes("nohut") ||
    lower.includes("fasulye")
  ) {
    return CATEGORY_MAP.bakliyat;
  }

  if (
    lower.includes("yağ") ||
    lower.includes("yag") ||
    lower.includes("zeytinyağı") ||
    lower.includes("tereyağı")
  ) {
    return CATEGORY_MAP.yag;
  }

  return CATEGORY_MAP.diger;
}

/**
 * Haftalık öğün planlarındaki tarif malzemelerini toplar, tekilleştirir ve kategorilendirir.
 */
export function aggregateShoppingList(
  plannedMeals: PlannedRecipeItem[]
): Record<string, AggregatedShoppingItem[]> {
  const itemMap = new Map<
    string,
    { name: string; category: string; totalGrams: number }
  >();

  for (const meal of plannedMeals) {
    const servings = meal.servings || 1;
    for (const ing of meal.ingredients) {
      const normalizedName = ing.name.trim();
      const scaledGrams = ing.grams * servings;
      const category = resolveShoppingCategory(ing.category || ing.name);

      const existing = itemMap.get(normalizedName);
      if (existing) {
        existing.totalGrams += scaledGrams;
      } else {
        itemMap.set(normalizedName, {
          name: normalizedName,
          category,
          totalGrams: scaledGrams,
        });
      }
    }
  }

  const grouped: Record<string, AggregatedShoppingItem[]> = {};

  for (const item of itemMap.values()) {
    let formattedAmount: string;
    if (item.totalGrams >= 1000) {
      const kg = Math.round((item.totalGrams / 1000) * 10) / 10;
      formattedAmount = `${kg} kg`;
    } else {
      formattedAmount = `${Math.round(item.totalGrams)} g`;
    }

    const categoryKey = item.category;
    if (!grouped[categoryKey]) {
      grouped[categoryKey] = [];
    }

    grouped[categoryKey].push({
      name: item.name,
      category: item.category,
      totalGrams: Math.round(item.totalGrams),
      formattedAmount,
    });
  }

  // Kategorilerin içini alfabetik sırala
  for (const cat in grouped) {
    grouped[cat].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  return grouped;
}
