import { describe, expect, it } from "vitest";
import { builtinMeasuresFor, mergeMeasures, MEASURE_NAMES, recipeMeasuresFor, recipePortionText, RECIPE_SERVING_UNITS } from "@/lib/measures";

describe("F73: ev ölçüleri", () => {
  it("besin adına göre yerleşik ölçüler (Türkçe karakter ve ek farklarına toleranslı)", () => {
    expect(builtinMeasuresFor("Yulaf Ezmesi")).toEqual(expect.arrayContaining([{ name: "yemek kaşığı", grams: 8 }, { name: "su bardağı", grams: 80 }]));
    expect(builtinMeasuresFor("Süt (%1.5 yarım yağlı)")).toEqual(expect.arrayContaining([{ name: "su bardağı", grams: 205 }]));
    expect(builtinMeasuresFor("Yumurta (büyük boy, adet ~50g)")).toEqual([{ name: "adet", grams: 50 }]);
    expect(builtinMeasuresFor("Tam Buğday Ekmeği")).toEqual([{ name: "dilim", grams: 30 }]);
    expect(builtinMeasuresFor("Ejder Meyvesi")).toEqual([]);
  });

  it("kullanıcının ölçüsü aynı adlı yerleşik ölçünün yerine geçer; sıra ölçü listesine göre", () => {
    const merged = mergeMeasures(builtinMeasuresFor("Yulaf Ezmesi"), [{ id: "m1", name: "yemek kaşığı", grams: 10 }, { id: "m2", name: "avuç", grams: 30 }]);
    expect(merged.find((m) => m.name === "yemek kaşığı")).toEqual({ id: "m1", name: "yemek kaşığı", grams: 10, source: "custom" });
    expect(merged.map((m) => m.name)).toEqual([...merged.map((m) => m.name)].sort((a, b) => MEASURE_NAMES.indexOf(a as never) - MEASURE_NAMES.indexOf(b as never)));
  });
});

describe("B11: tarifte ev ölçüsü tarifin porsiyonundan gelir", () => {
  it("çorbada kase bir porsiyondur; kepçe yerleşik gramla kalır", () => {
    const measures = recipeMeasuresFor("Mercimek Çorbası", 248.75);
    expect(measures).toEqual([
      { name: "kepçe", grams: 120 },
      { name: "kase", grams: 248.8 },
      { name: "porsiyon", grams: 248.8 },
    ]);
  });

  it("porsiyon, kase, adet ve dilim tarifte bir porsiyon sayılır", () => {
    expect([...RECIPE_SERVING_UNITS].sort()).toEqual(["adet", "dilim", "kase", "porsiyon"]);
    expect(recipeMeasuresFor("Lahmacun", 0)).toEqual([]);
  });

  it("tarifin talimatındaki porsiyon ölçüsü de bir porsiyondur", () => {
    expect(recipePortionText("Porsiyon: 1 su bardağı. Değerler...")).toBe("1 su bardağı");
    expect(recipePortionText("Haşla ve karıştır")).toBeNull();
    expect(recipeMeasuresFor("Ayran", 200, "Porsiyon: 1 su bardağı. Değerler...")).toEqual([
      { name: "çay bardağı", grams: 100 },
      { name: "su bardağı", grams: 200 },
      { name: "porsiyon", grams: 200 },
    ]);
  });
});
