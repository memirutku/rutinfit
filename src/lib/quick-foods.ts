/**
 * F79: Türk sofrası için tek tıkla eklenen kalemler. Değerler 100 g içindir ve tahminidir
 * (beyaz ekmek: USDA "Bread, white"; simit: yaygın etiket değerleri). Kullanıcı katalogda
 * düzenleyebilir.
 */
export interface QuickFood {
  name: string;
  label: string;
  category: string;
  basisGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionGrams: number;
  unit: string;
}

export const QUICK_FOODS = {
  simit: {
    name: "Simit",
    label: "Simit",
    category: "Kuru Gıda & Tahıllar",
    basisGrams: 100,
    calories: 275,
    proteinG: 9,
    carbsG: 52,
    fatG: 3.5,
    portionGrams: 110,
    unit: "adet",
  },
  "ekmek-dilimi": {
    name: "Beyaz Ekmek",
    label: "Ekmek dilimi",
    category: "Kuru Gıda & Tahıllar",
    basisGrams: 100,
    calories: 266,
    proteinG: 8.9,
    carbsG: 49.2,
    fatG: 3.3,
    portionGrams: 25,
    unit: "dilim",
  },
} as const satisfies Record<string, QuickFood>;

export type QuickFoodId = keyof typeof QUICK_FOODS;
export const QUICK_FOOD_IDS = Object.keys(QUICK_FOODS) as [QuickFoodId, ...QuickFoodId[]];

/** Bir küp şeker ≈ 4 g (16 kcal, 4 g karbonhidrat). */
export const SUGAR_CUBE_G = 4;

/** Çay ve Türk kahvesi için şeker seçenekleri (Türk kahvesinde sade / az / orta / şekerli). */
export const SUGAR_OPTIONS = [
  { label: "Şekersiz / sade", cubes: 0 },
  { label: "½ küp (az)", cubes: 0.5 },
  { label: "1 küp (orta)", cubes: 1 },
  { label: "2 küp (şekerli)", cubes: 2 },
  { label: "3 küp", cubes: 3 },
] as const;

/** Şeker seçimi uygulanan hazır içecekler. */
export const SUGARABLE_DRINKS = new Set(["cay", "turk-kahvesi"]);
