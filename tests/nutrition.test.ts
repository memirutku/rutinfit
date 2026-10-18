import { describe, it, expect } from "vitest";
import {
  calculateEnergyFromMacros,
  calculatePortionMacros,
  calculateRecipeMacros,
  calculateDailySummary,
} from "../src/lib/nutrition-calculator";

describe("Deterministik Beslenme Hesaplayıcı", () => {
  it("Brief'teki makro-kalori dengesini doğru hesaplamalı (165P + 220C + 60F = 2.080 kcal)", () => {
    const energy = calculateEnergyFromMacros(165, 220, 60);
    // 165 * 4 = 660, 220 * 4 = 880, 60 * 9 = 540 -> 660 + 880 + 540 = 2080
    expect(energy).toBe(2080);
  });

  it("150g tavuk göğsü porsiyon makrolarını tam hesaplamalı", () => {
    const chicken = {
      basisGrams: 100,
      calories: 120,
      proteinG: 23,
      carbsG: 0,
      fatG: 2.5,
    };
    const portion = calculatePortionMacros(chicken, 150);
    expect(portion.calories).toBe(180);
    expect(portion.proteinG).toBe(34.5);
    expect(portion.carbsG).toBe(0);
    expect(portion.fatG).toBe(3.8);
  });

  it("Bir tarifteki tüm malzemelerin toplamını doğru hesaplamalı", () => {
    const ingredients = [
      {
        grams: 100,
        foodItem: {
          basisGrams: 100,
          calories: 143,
          proteinG: 12.6,
          carbsG: 0.7,
          fatG: 9.5,
        },
      },
      {
        grams: 50,
        foodItem: {
          basisGrams: 100,
          calories: 370,
          proteinG: 13.0,
          carbsG: 62.0,
          fatG: 7.0,
        },
      },
    ];

    const recipeMacros = calculateRecipeMacros(ingredients);
    // Yumurta 100g: 143 kcal, 12.6 P, 0.7 C, 9.5 F
    // Yulaf 50g: 185 kcal, 6.5 P, 31 C, 3.5 F
    // Toplam: 328 kcal, 19.1 P, 31.7 C, 13 F
    expect(recipeMacros.calories).toBe(328);
    expect(recipeMacros.proteinG).toBe(19.1);
    expect(recipeMacros.carbsG).toBe(31.7);
    expect(recipeMacros.fatG).toBe(13);
  });

  it("2100 kcal tavanına yaklaşıldığında sakin uyarı mesajı üretmeli", () => {
    const targets = {
      calorieTarget: 2080,
      calorieCeiling: 2100,
      proteinTargetG: 165,
      fatTargetG: 60,
      carbTargetG: 220,
    };

    // 2050 kcal alındığında (tavana 50 kcal kaldı)
    const logs = [
      { calories: 2050, proteinG: 160, carbsG: 215, fatG: 58 },
    ];
    const summary = calculateDailySummary(logs, targets);
    expect(summary.ceilingAlert.isApproaching).toBe(true);
    expect(summary.ceilingAlert.isExceeded).toBe(false);
    expect(summary.ceilingAlert.diffFromCeiling).toBe(50);
    expect(summary.ceilingAlert.message).toContain("Günlük üst sınıra (2100 kcal) yaklaşıyorsunuz");
  });

  it("2100 kcal aşıldığında suçlayıcı olmayan telafi edici uyarı üretmeli", () => {
    const targets = {
      calorieTarget: 2080,
      calorieCeiling: 2100,
      proteinTargetG: 165,
      fatTargetG: 60,
      carbTargetG: 220,
    };

    const logs = [
      { calories: 2150, proteinG: 170, carbsG: 230, fatG: 62 },
    ];
    const summary = calculateDailySummary(logs, targets);
    expect(summary.ceilingAlert.isExceeded).toBe(true);
    expect(summary.ceilingAlert.diffFromCeiling).toBe(-50);
    expect(summary.ceilingAlert.message).toContain("hafifçe aşıldı");
    expect(summary.ceilingAlert.message).toContain("tamamen doğaldır");
  });
});
