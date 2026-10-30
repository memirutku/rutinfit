/**
 * F74: Türk ev yemekleri kataloğu. Yemeklerin değerleri RutinFit tariflerinden hesaplanır:
 * her yemek, 100 g değerleri bilinen malzemelerden oluşan bir tariftir (porsiyon = toplam / porsiyon
 * sayısı). Malzeme değerleri USDA FoodData Central (SR Legacy) çiğ değerlerine yakındır; kataloğun
 * mevcut besinleriyle aynı adı taşıyan malzemelerde kullanıcının kendi kaydı kullanılır.
 * Tuz ve baharat ihmal edilir; kızartma yağı emilimi tahminidir.
 */
export interface CatalogIngredient {
  name: string;
  category: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Değerin kaynağı (verilmezse "USDA FDC (yaklaşık)"). */
  source?: string;
}

const ing = (name: string, category: string, calories: number, proteinG: number, carbsG: number, fatG: number): CatalogIngredient => ({
  name,
  category,
  calories,
  proteinG,
  carbsG,
  fatG,
});

/** Mevcut başlangıç kataloğundaki adlarla aynı olanlar varsa onlar kullanılır. */
export const CATALOG_INGREDIENTS: CatalogIngredient[] = [
  ing("Kırmızı Mercimek (çiğ)", "Bakliyatlar", 340, 24, 60, 1.5),
  ing("Pilavlık Bulgur (çiğ)", "Kuru Gıda & Tahıllar", 340, 12, 76, 1.3),
  ing("Pirinç (baldo/basmati)", "Kuru Gıda & Tahıllar", 350, 7, 79, 0.6),
  ing("Zeytinyağı", "Yağlar & Soslar", 884, 0, 0, 100),
  ing("Yoğurt (%1.5 az yağlı)", "Süt Ürünleri & Yumurta", 56, 4.5, 6, 1.5),
  ing("Yumurta (büyük boy, adet ~50g)", "Süt Ürünleri & Yumurta", 143, 12.6, 0.7, 9.5),
  ing("Tavuk Göğsü (çiğ)", "Kasap & Balık", 120, 22.5, 0, 2.6),
  ing("Domates", "Manav (Sebze & Meyve)", 18, 0.9, 3.9, 0.2),
  ing("Salatalık", "Manav (Sebze & Meyve)", 15, 0.7, 3.6, 0.1),
  ing("Kuru Soğan", "Manav (Sebze & Meyve)", 40, 1.1, 9.3, 0.1),
  ing("Havuç", "Manav (Sebze & Meyve)", 41, 0.9, 9.6, 0.2),
  ing("Patlıcan", "Manav (Sebze & Meyve)", 25, 1, 5.9, 0.2),
  ing("Sivri Biber", "Manav (Sebze & Meyve)", 20, 0.9, 4.6, 0.2),
  ing("Ispanak", "Manav (Sebze & Meyve)", 23, 2.9, 3.6, 0.4),
  ing("Taze Fasulye", "Manav (Sebze & Meyve)", 31, 1.8, 7, 0.2),
  ing("Maydanoz", "Manav (Sebze & Meyve)", 36, 3, 6.3, 0.8),
  ing("Sarımsak", "Manav (Sebze & Meyve)", 149, 6.4, 33.1, 0.5),
  ing("Tereyağı", "Yağlar & Soslar", 717, 0.9, 0.1, 81.1),
  ing("Domates Salçası", "Yağlar & Soslar", 82, 4.3, 18.9, 0.5),
  ing("Buğday Unu", "Kuru Gıda & Tahıllar", 364, 10.3, 76.3, 1),
  ing("Kuru Fasulye (çiğ)", "Bakliyatlar", 333, 23.4, 60.3, 0.9),
  ing("Nohut (çiğ)", "Bakliyatlar", 378, 20.5, 63, 6),
  ing("Dana Kıyma (%20 yağlı, çiğ)", "Kasap & Balık", 254, 17.2, 0, 20),
  ing("İçme Suyu", "Diğer", 0, 0, 0, 0),
];

export interface CatalogDish {
  name: string;
  servings: number;
  prepMinutes: number;
  /** "1 kase", "1 adet" gibi porsiyon tarifi (talimatta gösterilir). */
  portion: string;
  ingredients: Array<{ name: string; grams: number }>;
}

const d = (name: string, servings: number, prepMinutes: number, portion: string, ingredients: Array<[string, number]>): CatalogDish => ({
  name,
  servings,
  prepMinutes,
  portion,
  ingredients: ingredients.map(([n, grams]) => ({ name: n, grams })),
});

export const TURKISH_DISHES: CatalogDish[] = [
  d("Mercimek Çorbası", 6, 40, "1 kase", [
    ["Kırmızı Mercimek (çiğ)", 250],
    ["Kuru Soğan", 100],
    ["Havuç", 80],
    ["Tereyağı", 30],
    ["Buğday Unu", 15],
    ["Domates Salçası", 15],
    ["İçme Suyu", 1500],
  ]),
  d("Yayla Çorbası", 6, 35, "1 kase", [
    ["Yoğurt (%1.5 az yağlı)", 500],
    ["Pirinç (baldo/basmati)", 70],
    ["Buğday Unu", 20],
    ["Yumurta (büyük boy, adet ~50g)", 50],
    ["Tereyağı", 20],
    ["İçme Suyu", 1300],
  ]),
  d("Bulgur Pilavı", 4, 30, "1 porsiyon", [
    ["Pilavlık Bulgur (çiğ)", 250],
    ["Tereyağı", 30],
    ["Zeytinyağı", 10],
    ["Kuru Soğan", 50],
    ["Domates Salçası", 15],
    ["İçme Suyu", 500],
  ]),
  d("Pirinç Pilavı", 4, 30, "1 porsiyon", [
    ["Pirinç (baldo/basmati)", 250],
    ["Tereyağı", 30],
    ["İçme Suyu", 400],
  ]),
  d("Kuru Fasulye", 6, 90, "1 porsiyon", [
    ["Kuru Fasulye (çiğ)", 400],
    ["Dana Kıyma (%20 yağlı, çiğ)", 100],
    ["Kuru Soğan", 150],
    ["Domates Salçası", 40],
    ["Zeytinyağı", 40],
    ["İçme Suyu", 1200],
  ]),
  d("Nohut Yemeği", 6, 90, "1 porsiyon", [
    ["Nohut (çiğ)", 400],
    ["Kuru Soğan", 150],
    ["Domates Salçası", 40],
    ["Zeytinyağı", 40],
    ["İçme Suyu", 1200],
  ]),
  d("Karnıyarık", 4, 60, "1 adet", [
    ["Patlıcan", 600],
    ["Dana Kıyma (%20 yağlı, çiğ)", 250],
    ["Kuru Soğan", 150],
    ["Domates", 200],
    ["Sivri Biber", 80],
    ["Zeytinyağı", 60],
    ["Domates Salçası", 20],
  ]),
  d("Ispanak Yemeği", 4, 30, "1 porsiyon", [
    ["Ispanak", 800],
    ["Kuru Soğan", 100],
    ["Pirinç (baldo/basmati)", 50],
    ["Zeytinyağı", 40],
    ["Domates Salçası", 15],
    ["İçme Suyu", 200],
  ]),
  d("Zeytinyağlı Taze Fasulye", 4, 45, "1 porsiyon", [
    ["Taze Fasulye", 600],
    ["Domates", 250],
    ["Kuru Soğan", 100],
    ["Zeytinyağı", 60],
  ]),
  d("Menemen", 2, 15, "1 porsiyon", [
    ["Yumurta (büyük boy, adet ~50g)", 200],
    ["Domates", 300],
    ["Sivri Biber", 100],
    ["Zeytinyağı", 20],
  ]),
  d("Tavuk Sote", 4, 30, "1 porsiyon", [
    ["Tavuk Göğsü (çiğ)", 600],
    ["Kuru Soğan", 150],
    ["Sivri Biber", 150],
    ["Domates", 200],
    ["Zeytinyağı", 30],
  ]),
  d("Kısır", 6, 25, "1 porsiyon", [
    ["Pilavlık Bulgur (çiğ)", 250],
    ["Domates Salçası", 30],
    ["Kuru Soğan", 50],
    ["Maydanoz", 50],
    ["Domates", 150],
    ["Salatalık", 100],
    ["Zeytinyağı", 40],
    ["İçme Suyu", 300],
  ]),
  d("Cacık", 4, 10, "1 kase", [
    ["Yoğurt (%1.5 az yağlı)", 500],
    ["Salatalık", 300],
    ["Sarımsak", 5],
    ["İçme Suyu", 200],
    ["Zeytinyağı", 10],
  ]),
  d("Ayran", 1, 2, "1 su bardağı", [
    ["Yoğurt (%1.5 az yağlı)", 100],
    ["İçme Suyu", 100],
  ]),
  d("Lahmacun", 6, 60, "1 adet", [
    ["Buğday Unu", 400],
    ["İçme Suyu", 250],
    ["Dana Kıyma (%20 yağlı, çiğ)", 250],
    ["Kuru Soğan", 100],
    ["Domates", 150],
    ["Sivri Biber", 50],
    ["Maydanoz", 30],
    ["Domates Salçası", 20],
  ]),
];

/** Bir porsiyonun kalorisi (malzeme değerleri bu listeden; kullanıcının kendi kaydı DB'de farklı olabilir). */
export function dishPortionKcal(dish: CatalogDish, ingredients: CatalogIngredient[] = CATALOG_INGREDIENTS): number {
  const total = dish.ingredients.reduce((a, i) => {
    const v = ingredients.find((x) => x.name === i.name);
    return a + (v ? (v.calories * i.grams) / 100 : 0);
  }, 0);
  return Math.round(total / dish.servings);
}
