/**
 * B01: Başlangıç kataloğunun temel besinleri. Değerler 100 g içindir; kaynak her satırda yazılıdır
 * (USDA FoodData Central SR Legacy ve TÜRKOMP). Uygulama ilk açılışta bunları, Türk ev yemekleri
 * paketini (turkish-catalog.ts) ve hızlı kalemleri (quick-foods.ts) bir kez kurar
 * (services/starter-catalog.ts). Geliştirme seed'i de aynı listeyi kullanır.
 */
export interface StarterFood {
  name: string;
  category: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: string;
  confidence: string;
}

const food = (
  name: string,
  category: string,
  calories: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  source: string,
): StarterFood => ({ name, category, calories, proteinG, carbsG, fatG, source, confidence: "Yüksek" });

export const STARTER_FOODS: StarterFood[] = [
  food("Tavuk Göğsü (çiğ)", "Kasap & Balık", 120, 23, 0, 2.5, "USDA/TÜRKOMP"),
  food("Yumurta (büyük boy, adet ~50g)", "Süt Ürünleri & Yumurta", 143, 12.6, 0.7, 9.5, "USDA"),
  food("Lor Peyniri (az yağlı)", "Süt Ürünleri & Yumurta", 85, 17, 3, 0.5, "TÜRKOMP"),
  food("Yoğurt (%1.5 az yağlı)", "Süt Ürünleri & Yumurta", 56, 4, 5, 1.5, "TÜRKOMP"),
  food("Süt (%1.5 yarım yağlı)", "Süt Ürünleri & Yumurta", 46, 3.2, 4.8, 1.5, "TÜRKOMP"),
  food("Yulaf Ezmesi", "Kuru Gıda & Tahıllar", 370, 13, 62, 7, "USDA"),
  food("Pilavlık Bulgur (çiğ)", "Kuru Gıda & Tahıllar", 340, 12, 68, 1.5, "TÜRKOMP"),
  food("Pirinç (baldo/basmati)", "Kuru Gıda & Tahıllar", 350, 7, 78, 0.8, "USDA"),
  food("Tam Buğday Ekmeği", "Kuru Gıda & Tahıllar", 245, 10, 44, 2.5, "TÜRKOMP"),
  food("Patates (çiğ)", "Manav (Sebze & Meyve)", 77, 2, 17.5, 0.1, "USDA"),
  food("Muz", "Manav (Sebze & Meyve)", 89, 1.1, 22.8, 0.3, "USDA"),
  food("Elma", "Manav (Sebze & Meyve)", 52, 0.3, 13.8, 0.2, "USDA"),
  food("Zeytinyağı", "Yağlar & Soslar", 884, 0, 0, 100, "USDA"),
  food("Ton Balığı (süzülmüş, su bazlı)", "Kasap & Balık", 110, 25, 0, 0.8, "USDA"),
  food("Kırmızı Mercimek (çiğ)", "Bakliyatlar", 340, 24, 57, 1.2, "TÜRKOMP"),
  food("Ceviz İçi", "Kuru Gıda & Tahıllar", 654, 15.2, 13.7, 65.2, "USDA"),
  food("Salatalık", "Manav (Sebze & Meyve)", 15, 0.7, 3.6, 0.1, "USDA"),
  food("Domates", "Manav (Sebze & Meyve)", 18, 0.9, 3.9, 0.2, "USDA"),
];
