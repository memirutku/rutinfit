import { describe, expect, it } from "vitest";
import { mealTypeForHour } from "@/lib/meal-time";
import { QUICK_FOODS, SUGAR_CUBE_G, SUGAR_OPTIONS } from "@/lib/quick-foods";

describe("F79: saate göre öğün", () => {
  it("ritim kartıyla aynı sınırlar", () => {
    expect([6, 10, 11, 15, 16, 18, 19, 21, 22, 23].map(mealTypeForHour)).toEqual([
      "breakfast", "breakfast", "lunch", "lunch", "workSnack", "workSnack", "dinner", "dinner", "extra", "extra",
    ]);
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
