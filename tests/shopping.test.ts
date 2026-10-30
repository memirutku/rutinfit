import { describe, it, expect } from "vitest";
import {
  aggregateShoppingList,
  resolveShoppingCategory,
} from "../src/lib/shopping-aggregator";

describe("Alışveriş Listesi Tekilleştirici ve Gruplayıcı", () => {
  it("Kategorileri doğru eşleştirmeli", () => {
    expect(resolveShoppingCategory("Tavuk Göğsü")).toBe("Kasap & Balık");
    expect(resolveShoppingCategory("Muz")).toBe("Manav (Sebze & Meyve)");
    expect(resolveShoppingCategory("Yoğurt")).toBe("Süt Ürünleri & Yumurta");
    expect(resolveShoppingCategory("Pilavlık Bulgur")).toBe("Kuru Gıda & Tahıllar");
    expect(resolveShoppingCategory("Zeytinyağı")).toBe("Yağlar & Soslar");
  });

  it("Aynı malzemeleri toplayıp porsiyon katsayısına göre tekilleştirmeli", () => {
    const plannedMeals = [
      {
        recipeName: "Öğle Yemeği",
        servings: 2, // 2 porsiyon = 2 * 150 = 300g
        ingredients: [
          { name: "Tavuk Göğsü", category: "kasap", grams: 150 },
          { name: "Bulgur", category: "tahil", grams: 70 },
        ],
      },
      {
        recipeName: "Akşam Yemeği",
        servings: 1, // 1 porsiyon = 200g
        ingredients: [
          { name: "Tavuk Göğsü", category: "kasap", grams: 200 },
          { name: "Yoğurt", category: "sut", grams: 100 },
        ],
      },
    ];

    const result = aggregateShoppingList(plannedMeals);
    const kasapItems = result["Kasap & Balık"];

    expect(kasapItems).toBeDefined();
    const chicken = kasapItems.find((i) => i.name === "Tavuk Göğsü");
    expect(chicken).toBeDefined();
    // 300g + 200g = 500g
    expect(chicken?.totalGrams).toBe(500);
    expect(chicken?.formattedAmount).toBe("500 g");

    const sutItems = result["Süt Ürünleri & Yumurta"];
    const yogurt = sutItems.find((i) => i.name === "Yoğurt");
    expect(yogurt?.totalGrams).toBe(100);
  });

  it("1000g ve üzerini kg olarak biçimlendirmeli", () => {
    const plannedMeals = [
      {
        recipeName: "Haftalık Tavuk",
        servings: 1,
        ingredients: [{ name: "Tavuk Göğsü", category: "kasap", grams: 1500 }],
      },
    ];

    const result = aggregateShoppingList(plannedMeals);
    const chicken = result["Kasap & Balık"].find((i) => i.name === "Tavuk Göğsü");
    expect(chicken?.formattedAmount).toBe("1.5 kg");
  });
});

describe("resolveShoppingCategory — kelime bazlı ve Türkçe büyük/küçük harf", () => {
  it("'paketli' veya 'spagetti' içindeki 'et' hecesi kasap sayılmaz", () => {
    expect(resolveShoppingCategory("Paketli Gıda")).not.toBe("Kasap & Balık");
    expect(resolveShoppingCategory("Spagetti")).not.toBe("Kasap & Balık");
    expect(resolveShoppingCategory("Ketçap")).not.toBe("Kasap & Balık");
  });

  it("'Dana Eti' ve 'Ton Balığı' kasaptır", () => {
    expect(resolveShoppingCategory("Dana Eti")).toBe("Kasap & Balık");
    expect(resolveShoppingCategory("Ton Balığı")).toBe("Kasap & Balık");
  });

  it("büyük 'I' ile başlayan Türkçe kelimeyi tanır (Ispanak → ıspanak)", () => {
    expect(resolveShoppingCategory("Ispanak")).toBe("Manav (Sebze & Meyve)");
  });

  it("genel/paketli kategori adı varsa besin adına göre karar verir", () => {
    expect(resolveShoppingCategory("Genel", "Tavuk Göğsü")).toBe("Kasap & Balık");
    expect(resolveShoppingCategory("Paketli Gıda", "Light Yoğurt")).toBe("Süt Ürünleri & Yumurta");
    expect(resolveShoppingCategory("Kasap & Balık", "Muz")).toBe("Kasap & Balık"); // açık kategori önceliklidir
  });
});

describe("aggregateShoppingList — tarif porsiyonu", () => {
  it("4 porsiyonluk tariften 1 porsiyon planlanınca malzemenin dörtte biri alınır", () => {
    const result = aggregateShoppingList([
      {
        recipeName: "Fırın Tavuk (4 kişilik)",
        recipeServings: 4,
        servings: 1,
        ingredients: [{ name: "Tavuk Göğsü", category: "Kasap & Balık", grams: 800 }],
      },
    ]);
    expect(result["Kasap & Balık"][0].totalGrams).toBe(200);
  });
});
