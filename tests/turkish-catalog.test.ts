import { describe, expect, it } from "vitest";
import { CATALOG_INGREDIENTS, dishPortionKcal, TURKISH_DISHES } from "@/lib/turkish-catalog";

describe("F74: Türk ev yemekleri kataloğu", () => {
  it("en az 12 yemek; adlar benzersiz; bütün malzemelerin değeri var", () => {
    expect(TURKISH_DISHES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(TURKISH_DISHES.map((d) => d.name)).size).toBe(TURKISH_DISHES.length);
    const known = new Set(CATALOG_INGREDIENTS.map((i) => i.name));
    const missing = TURKISH_DISHES.flatMap((d) => d.ingredients.map((i) => i.name)).filter((n) => !known.has(n));
    expect(missing).toEqual([]);
    for (const n of ["Mercimek Çorbası", "Bulgur Pilavı", "Kuru Fasulye", "Karnıyarık", "Lahmacun", "Ayran"]) {
      expect(TURKISH_DISHES.some((d) => d.name === n), n).toBe(true);
    }
  });

  it("porsiyon kalorileri makul aralıkta (yaygın referanslarla tutarlı)", () => {
    const kcal = Object.fromEntries(TURKISH_DISHES.map((d) => [d.name, dishPortionKcal(d)]));
    expect(kcal["Mercimek Çorbası"]).toBeGreaterThanOrEqual(150);
    expect(kcal["Mercimek Çorbası"]).toBeLessThanOrEqual(260);
    expect(kcal["Ayran"]).toBeGreaterThanOrEqual(45);
    expect(kcal["Ayran"]).toBeLessThanOrEqual(90);
    expect(kcal["Lahmacun"]).toBeGreaterThanOrEqual(250);
    expect(kcal["Lahmacun"]).toBeLessThanOrEqual(420);
    expect(kcal["Bulgur Pilavı"]).toBeGreaterThanOrEqual(220);
    expect(kcal["Bulgur Pilavı"]).toBeLessThanOrEqual(350);
  });

  it("malzeme makroları enerjiyle tutarlı (yazım hatasına karşı 4/4/9 denetimi; su hariç)", () => {
    for (const i of CATALOG_INGREDIENTS.filter((x) => x.calories > 0)) {
      const atwater = i.proteinG * 4 + i.carbsG * 4 + i.fatG * 9;
      // USDA karbonhidratı lifi içerir; lifli malzemede (sebze, salça) 4/4/9 enerjiyi yüksek gösterir.
      const tolerance = i.calories < 60 ? 0.35 : 0.25;
      expect(Math.abs(atwater - i.calories) / i.calories, i.name).toBeLessThan(tolerance);
    }
  });
});
