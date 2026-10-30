import { normalizeName, wordsTr } from "./text";

export interface PlannedRecipeItem {
  recipeName: string;
  /** Planlanan porsiyon sayısı (0.5x, 1x, 1.5x ...). */
  servings: number;
  /** Tarifin malzeme listesinin kaç porsiyon verdiği (Recipe.servings). Varsayılan 1. */
  recipeServings?: number;
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

/**
 * Anahtar kelimeler kelime başı olarak eşleşir ("et" → "et", "eti"; ama "paketli", "spagetti" değil).
 * Kısa kelimeler (≤3 harf) yalnız tam kelime veya iyelik ekiyle (-i/-ı) eşleşir.
 */
const KEYWORDS: Array<[keyof typeof CATEGORY_MAP, string[]]> = [
  ["kasap", ["kasap", "tavuk", "kıyma", "et", "dana", "kuzu", "hindi", "ton", "somon", "balık", "balığ", "levrek", "çupra", "karides", "köfte", "biftek", "bonfile", "sucuk", "pastırma"]],
  ["sut", ["süt", "sut", "yumurta", "yoğurt", "lor", "peynir", "kefir", "ayran", "kaymak", "labne", "tereyağ"]],
  ["manav", ["manav", "muz", "elma", "ıspanak", "domates", "salatalık", "biber", "marul", "patates", "meyve", "sebze", "soğan", "sarımsak", "havuç", "brokoli", "kabak", "limon", "portakal", "maydanoz", "roka", "avokado", "çilek"]],
  ["tahil", ["tahıl", "tahil", "yulaf", "pirinç", "bulgur", "ekmek", "makarna", "spagetti", "un", "lavaş", "tortilla", "kinoa", "granola", "galeta"]],
  ["bakliyat", ["bakliyat", "mercimek", "nohut", "fasulye", "barbunya", "bezelye"]],
  ["yag", ["yağ", "yag", "zeytinyağ", "sos", "ketçap", "mayonez", "hardal", "sirke", "baharat"]],
];

function wordMatches(word: string, keyword: string): boolean {
  if (word === keyword) return true;
  if (keyword.length <= 3) return word === `${keyword}i` || word === `${keyword}ı`;
  return word.startsWith(keyword);
}

function matchByKeywords(text: string): string | null {
  const words = wordsTr(text);
  // "Ton balığı": ilk kelimeden itibaren tarandığı için doğru kategori bulunur.
  for (const [key, keywords] of KEYWORDS) {
    if (words.some((w) => keywords.some((k) => wordMatches(w, k)))) return CATEGORY_MAP[key];
  }
  return null;
}

function matchExactCategory(value: string): string | null {
  const lower = normalizeName(value);
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  for (const catVal of Object.values(CATEGORY_MAP)) {
    if (lower === normalizeName(catVal)) return catVal;
  }
  return null;
}

/**
 * Alışveriş reyonunu belirler. Önce açık kategori (ör. "Kasap & Balık" veya "kasap"),
 * sonra kategori metnindeki kelimeler, en son besin adı denenir. "Genel" veya
 * "Paketli Gıda" gibi reyon belirtmeyen kategoriler besin adına bırakılır.
 */
export function resolveShoppingCategory(categoryOrFoodName: string, foodName?: string): string {
  const exact = matchExactCategory(categoryOrFoodName);
  if (exact && exact !== CATEGORY_MAP.diger) return exact;

  return (
    matchByKeywords(categoryOrFoodName) ??
    (foodName ? matchByKeywords(foodName) : null) ??
    CATEGORY_MAP.diger
  );
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
    // Malzeme gramajı tarifin tamamı içindir: önce porsiyona böl, sonra planlanan porsiyonla çarp.
    const portionFactor = (meal.servings || 1) / (meal.recipeServings && meal.recipeServings > 0 ? meal.recipeServings : 1);
    for (const ing of meal.ingredients) {
      const displayName = ing.name.trim();
      const key = normalizeName(displayName);
      const scaledGrams = ing.grams * portionFactor;
      const category = resolveShoppingCategory(ing.category || ing.name, ing.name);

      const existing = itemMap.get(key);
      if (existing) {
        existing.totalGrams += scaledGrams;
      } else {
        itemMap.set(key, {
          name: displayName,
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
