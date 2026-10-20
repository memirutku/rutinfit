export type FoodsTab = "foods" | "recipes" | "packaged";

/** Katalog filtre kategorileri ("all" = Tümü). */
export const FOOD_CATEGORIES = [
  "all",
  "Kasap & Balık",
  "Süt Ürünleri & Yumurta",
  "Kuru Gıda & Tahıllar",
  "Manav (Sebze & Meyve)",
  "Bakliyatlar",
  "Yağlar & Soslar",
] as const;

export const QUICK_SEARCH_TAGS = [
  "Yulaf Ezmesi",
  "Protein Bar",
  "Ton Balığı",
  "Kefir",
  "Yer Fıstığı Ezmesi",
  "Süt",
  "Labne",
] as const;

export interface FoodsNotice {
  type: "success" | "error";
  text: string;
}
