import { describe, expect, it } from "vitest";
import { macroMismatch, redistributeMacros } from "@/lib/macro-balance";
import { calculateEnergyFromMacros } from "@/lib/nutrition-calculator";

const energy = (m: { proteinG: number; carbsG: number; fatG: number }) => calculateEnergyFromMacros(m.proteinG, m.carbsG, m.fatG);

describe("B15: makro–kalori dengesi", () => {
  it("makroların enerjisi kalori hedefinden belirgin farklıysa uyuşmazlık bildirir", () => {
    expect(macroMismatch(1500, { proteinG: 165, carbsG: 220, fatG: 60 })).toEqual({ macroKcal: 2080, diff: 580, mismatched: true });
    expect(macroMismatch(1500, { proteinG: 122, carbsG: 131, fatG: 42 })).toMatchObject({ macroKcal: 1390, diff: -110, mismatched: true });
    // Yuvarlama payı (±%3, en az 25 kcal) uyuşmazlık sayılmaz.
    expect(macroMismatch(2080, { proteinG: 165, carbsG: 220, fatG: 60 }).mismatched).toBe(false);
    expect(macroMismatch(1500, { proteinG: 119, carbsG: 159, fatG: 43 }).mismatched).toBe(false);
    expect(macroMismatch(0, { proteinG: 10, carbsG: 10, fatG: 10 }).mismatched).toBe(false);
  });

  it("makroları mevcut oranlarını koruyarak yeni kalori hedefine dağıtır", () => {
    const next = redistributeMacros(1500, { proteinG: 165, carbsG: 220, fatG: 60 })!;
    expect(next).toEqual({ proteinG: 119, carbsG: 159, fatG: 43 });
    expect(Math.abs(energy(next) - 1500)).toBeLessThanOrEqual(10);
    // Oranlar korunur: protein/karbonhidrat oranı aynı kalır.
    expect(next.proteinG / next.carbsG).toBeCloseTo(165 / 220, 1);
  });

  it("makrolar boşsa varsayılan dağılımı yeni hedefe ölçekler; geçersiz hedefte öneri yoktur", () => {
    const next = redistributeMacros(1800, { proteinG: 0, carbsG: 0, fatG: 0 })!;
    expect(next.proteinG).toBeGreaterThan(0);
    expect(next.carbsG).toBeGreaterThan(0);
    expect(next.fatG).toBeGreaterThan(0);
    expect(Math.abs(energy(next) - 1800)).toBeLessThanOrEqual(10);
    expect(redistributeMacros(0, { proteinG: 100, carbsG: 100, fatG: 50 })).toBeNull();
    expect(redistributeMacros(Number.NaN, { proteinG: 100, carbsG: 100, fatG: 50 })).toBeNull();
  });
});
