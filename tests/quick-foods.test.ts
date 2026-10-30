import { describe, expect, it } from "vitest";
import { mealChoicesForTime, mealTypeForHour } from "@/lib/meal-time";
import { QUICK_FOODS, SUGAR_CUBE_G, SUGAR_OPTIONS } from "@/lib/quick-foods";

describe("F79: saate göre öğün", () => {
  it("ritim kartıyla aynı sınırlar", () => {
    expect([6, 10, 11, 15, 16, 18, 19, 21, 22, 23].map(mealTypeForHour)).toEqual([
      "breakfast", "breakfast", "lunch", "lunch", "workSnack", "workSnack", "dinner", "dinner", "extra", "extra",
    ]);
  });
});

describe("B13: saat öğün sınırındaysa iki seçenek", () => {
  const at = (hh: number, mm: number) => new Date(2026, 9, 30, hh, mm);
  it("sınıra yarım saatten yakınsa iki öğün, değilse tek öğün", () => {
    expect(mealChoicesForTime(at(8, 0))).toEqual(["breakfast"]);
    expect(mealChoicesForTime(at(10, 40))).toEqual(["breakfast", "lunch"]);
    expect(mealChoicesForTime(at(11, 25))).toEqual(["breakfast", "lunch"]);
    expect(mealChoicesForTime(at(11, 31))).toEqual(["lunch"]);
    expect(mealChoicesForTime(at(15, 45))).toEqual(["lunch", "workSnack"]);
    expect(mealChoicesForTime(at(19, 10))).toEqual(["workSnack", "dinner"]);
    expect(mealChoicesForTime(at(21, 50))).toEqual(["dinner", "extra"]);
    expect(mealChoicesForTime(at(23, 0))).toEqual(["extra"]);
  });

  it("Ramazan modunda akşam iftar (akşam yemeği) sayılır", () => {
    expect(mealChoicesForTime(at(18, 0), true)).toEqual(["dinner"]);
    expect(mealChoicesForTime(at(4, 30), true)).toEqual(["breakfast"]);
  });
});

describe("F79: hızlı Türk sofrası", () => {
  it("simit ve ekmek dilimi porsiyonları ve şeker küpü", () => {
    expect(QUICK_FOODS.simit).toMatchObject({ portionGrams: 110, unit: "adet" });
    expect(QUICK_FOODS["ekmek-dilimi"]).toMatchObject({ portionGrams: 25, unit: "dilim" });
    expect(SUGAR_CUBE_G).toBe(4);
    expect(SUGAR_OPTIONS.map((s) => s.cubes)).toEqual([0, 0.5, 1, 2, 3]);
  });
});
