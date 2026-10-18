import { describe, it, expect } from "vitest";
import {
  MealProposalSchema,
  WorkoutAdjustmentSchema,
  AIActionResponseSchema,
} from "../src/lib/ai-schema";

describe("AI Yanıt ve Öneri Şeması Doğrulama", () => {
  it("Geçerli bir yemek önerisi JSON'unu doğrulamalı", () => {
    const validMeal = {
      type: "meal_proposal",
      mealType: "dinner",
      title: "Hafif Tavuklu Bulgur Kasesi",
      rationale: "Kalan protein ihtiyacını tamamlamak için yüksek proteinli seçenek",
      prepMinutes: 20,
      ingredients: [
        { foodName: "Tavuk Göğsü", grams: 180 },
        { foodName: "Bulgur", grams: 50 },
      ],
      estimatedMacros: {
        calories: 420,
        proteinG: 45,
        carbsG: 34,
        fatG: 6,
      },
    };

    const parsed = MealProposalSchema.safeParse(validMeal);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe("Hafif Tavuklu Bulgur Kasesi");
      expect(parsed.data.ingredients.length).toBe(2);
    }
  });

  it("Negatif kalori veya gramaj içeren hatalı veriyi reddetmeli", () => {
    const invalidMeal = {
      type: "meal_proposal",
      mealType: "dinner",
      title: "Hatalı Tarif",
      rationale: "Negatif kalori içeriyor",
      prepMinutes: 10,
      ingredients: [{ foodName: "Tavuk", grams: -50 }],
      estimatedMacros: {
        calories: -100,
        proteinG: 10,
        carbsG: 10,
        fatG: 5,
      },
    };

    const parsed = MealProposalSchema.safeParse(invalidMeal);
    expect(parsed.success).toBe(false);
  });

  it("Yorgunluk için kısaltılmış antrenman şemasını doğrulamalı", () => {
    const validAdjustment = {
      type: "workout_adjustment",
      title: "25 Dakikalık Hafifletilmiş A Seansı",
      targetDurationMinutes: 25,
      reason: "İş çıkışı yüksek yorgunluk nedeniyle hacim düşürüldü",
      exercises: [
        {
          exerciseName: "Squat",
          sets: 2,
          repMin: 8,
          repMax: 10,
          restSeconds: 120,
        },
        {
          exerciseName: "Bench Press",
          sets: 2,
          repMin: 8,
          repMax: 10,
          restSeconds: 90,
        },
      ],
    };

    const parsed = AIActionResponseSchema.safeParse(validAdjustment);
    expect(parsed.success).toBe(true);
  });
});
