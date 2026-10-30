import { describe, it, expect } from "vitest";
import {
  MealProposalSchema,
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

  describe("Tüm 7 Eylem Taslağı Şeması Doğrulaması", () => {
    it("meal_plan taslağını doğrulamalı ve geçersiz öğün tipini reddetmeli", async () => {
      const { validateDraftChanges } = await import("../src/lib/ai-schema");
      const valid = {
        date: "2026-10-18",
        notes: "Örnek haftalık plan",
        meals: [{ mealType: "breakfast", customName: "Kahvaltı", servings: 1 }],
      };
      expect(() => validateDraftChanges("meal_plan", valid)).not.toThrow();

      const invalid = {
        date: "18-10-2026", // Geçersiz format
      };
      expect(() => validateDraftChanges("meal_plan", invalid)).toThrow();
    });

    it("food_log taslağını doğrulamalı ve sıfır/negatif gramajı reddetmeli", async () => {
      const { validateDraftChanges } = await import("../src/lib/ai-schema");
      const valid = {
        name: "Yulaf",
        grams: 50,
        calories: 180,
      };
      expect(() => validateDraftChanges("food_log", valid)).not.toThrow();

      const invalid = {
        name: "Yulaf",
        grams: -10, // Negatif
      };
      expect(() => validateDraftChanges("food_log", invalid)).toThrow();
    });

    it("recipe taslağını ve pozitif porsiyon kontrolünü doğrulamalı", async () => {
      const { validateDraftChanges } = await import("../src/lib/ai-schema");
      const valid = {
        name: "Proteinli Yulaf Lapası",
        instructions: "Karıştır ve pişir",
        prepMinutes: 10,
        servings: 2,
        ingredients: [{ foodItemId: "food-1", grams: 100 }],
      };
      expect(() => validateDraftChanges("recipe", valid)).not.toThrow();

      const invalid = {
        name: "", // Boş ad
        servings: 0,
      };
      expect(() => validateDraftChanges("recipe", invalid)).toThrow();
    });

    it("nutrition_targets taslağını ve pozitif kalori kontrolünü doğrulamalı", async () => {
      const { validateDraftChanges } = await import("../src/lib/ai-schema");
      const valid = {
        calorieTarget: 2200,
        proteinTargetG: 160,
        fatTargetG: 70,
        carbTargetG: 230,
      };
      expect(() => validateDraftChanges("nutrition_targets", valid)).not.toThrow();

      const invalid = {
        calorieTarget: -500, // Negatif
        proteinTargetG: -20,
        fatTargetG: 70,
        carbTargetG: 200,
      };
      expect(() => validateDraftChanges("nutrition_targets", invalid)).toThrow();
    });

    it("workout_session taslağını ve set/tekrar sınırlarını doğrulamalı", async () => {
      const { validateDraftChanges } = await import("../src/lib/ai-schema");
      const valid = {
        name: "Üst Vücut Güç",
        durationMinutes: 50,
        sets: [
          { exerciseName: "Bench Press", setNumber: 1, weightKg: 80, reps: 8, rpe: 8 },
        ],
      };
      expect(() => validateDraftChanges("workout_session", valid)).not.toThrow();

      const invalid = {
        name: "", // Boş ad
        sets: [{ exerciseName: "Bench Press", reps: -5 }], // Negatif tekrar
      };
      expect(() => validateDraftChanges("workout_session", invalid)).toThrow();
    });

    it("weight_wellbeing taslağını ve 1-5 arası skor sınırlamasını doğrulamalı", async () => {
      const { validateDraftChanges } = await import("../src/lib/ai-schema");
      const valid = {
        date: "2026-10-18",
        weightKg: 111.5,
        energy1to5: 4,
        hunger1to5: 2,
        stress1to5: 3,
        sleepMinutes: 450,
      };
      expect(() => validateDraftChanges("weight_wellbeing", valid)).not.toThrow();

      const invalid = {
        energy1to5: 6, // 1-5 sınırının üstü
      };
      expect(() => validateDraftChanges("weight_wellbeing", invalid)).toThrow();
    });

    it("bulk_import taslağını doğrulamalı", async () => {
      const { validateDraftChanges } = await import("../src/lib/ai-schema");
      const valid = {
        importSource: "openFoodFacts",
        itemsCount: 10,
        records: [{ barcode: "123456" }],
      };
      expect(() => validateDraftChanges("bulk_import", valid)).not.toThrow();
    });
  });
});

describe("B29: öneri JSON'u sohbet metninden çıkarılır", () => {
  const meal = { type: "meal_proposal", mealType: "dinner", title: "Fırın somon", rationale: "r", ingredients: [{ foodName: "Somon", grams: 150 }], estimatedMacros: { calories: 600, proteinG: 40, carbsG: 45, fatG: 22 } };

  it("öneri bloğu (```json ya da etiketsiz) metinden silinir, kalan metin korunur", async () => {
    const { stripActionBlocks } = await import("../src/lib/ai-schema");
    expect(stripActionBlocks(`Akşam için önerim:\n\n\`\`\`json\n${JSON.stringify(meal, null, 2)}\n\`\`\`\n\nAfiyet olsun.`)).toBe("Akşam için önerim:\n\nAfiyet olsun.");
    expect(stripActionBlocks(`Öneri:\n\`\`\`\n${JSON.stringify(meal)}\n\`\`\``)).toBe("Öneri:");
    expect(stripActionBlocks(`Öneri:\n\`\`\`json\n${JSON.stringify({ type: "workout_adjustment", title: "x" })}\n\`\`\``)).toBe("Öneri:");
  });

  it("öneri olmayan kod blokları ve düz metin olduğu gibi kalır; yalnız blok varsa kart yönlendirmesi döner", async () => {
    const { stripActionBlocks } = await import("../src/lib/ai-schema");
    const other = "Örnek:\n```json\n{\"a\":1}\n```";
    expect(stripActionBlocks(other)).toBe(other);
    expect(stripActionBlocks("Sadece metin")).toBe("Sadece metin");
    expect(stripActionBlocks(`\`\`\`json\n${JSON.stringify(meal)}\n\`\`\``)).toBe("Önerimi aşağıdaki kartta bulabilirsin.");
  });
});
