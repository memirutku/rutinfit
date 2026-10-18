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
