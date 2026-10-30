import { describe, expect, it } from "vitest";
import { rankMealSuggestions, type MealCandidate } from "@/lib/meal-suggestions";

const c = (name: string, calories: number, proteinG: number, carbsG = 0, fatG = 0, source: MealCandidate["source"] = "saved_meal"): MealCandidate => ({
  id: name,
  source,
  name,
  calories,
  proteinG,
  carbsG,
  fatG,
});
const REMAINING = { calories: 700, proteinG: 60, carbsG: 80, fatG: 25 };

describe("B42: model olmadan öğün önerisi (kural tabanlı)", () => {
  it("kalan kaloriye sığanları, kalan proteini en çok karşılayan önce gelecek şekilde en fazla 3 öneri döner", () => {
    const result = rankMealSuggestions(
      [
        c("Tavuklu bulgur", 620, 55, 60, 15),
        c("Mercimek çorbası", 300, 18, 45, 8, "recipe"),
        c("Ton balıklı salata", 450, 45, 20, 18),
        c("Pizza", 1100, 40, 120, 45),
        c("Yoğurt", 150, 12, 10, 6),
      ],
      REMAINING
    );
    expect(result.reason).toBeUndefined();
    expect(result.suggestions.map((s) => s.name)).toEqual(["Tavuklu bulgur", "Ton balıklı salata", "Mercimek çorbası"]);
    expect(result.suggestions[0]).toMatchObject({ source: "saved_meal", calories: 620, proteinG: 55 });
    expect(result.suggestions[0].kcalShare).toBeCloseTo(620 / 700);
    expect(result.suggestions[0].proteinShare).toBeCloseTo(55 / 60);
    // Kalan kaloriyi aşan öneri listeye girmez.
    expect(result.suggestions.some((s) => s.name === "Pizza")).toBe(false);
  });

  it("protein zaten tamamsa kaloriye uyum belirler; kalan yağı aşan öğün geri düşer", () => {
    const { suggestions } = rankMealSuggestions(
      [c("Yağlı tabak", 600, 20, 30, 45), c("Dengeli tabak", 580, 20, 70, 15), c("Atıştırmalık", 200, 5, 25, 8)],
      { calories: 650, proteinG: 0, carbsG: 90, fatG: 20 }
    );
    expect(suggestions.map((s) => s.name)).toEqual(["Dengeli tabak", "Yağlı tabak", "Atıştırmalık"]);
  });

  it("kalan kalori yoksa, aday yoksa ya da hiçbiri sığmıyorsa nedenini söyler", () => {
    expect(rankMealSuggestions([c("A", 300, 20)], { ...REMAINING, calories: 30 })).toEqual({ suggestions: [], reason: "no_remaining" });
    expect(rankMealSuggestions([], REMAINING)).toEqual({ suggestions: [], reason: "no_candidates" });
    // Kalorisi bilinmeyen (0 kcal) aday sayılmaz.
    expect(rankMealSuggestions([c("Bilinmeyen", 0, 0)], REMAINING)).toEqual({ suggestions: [], reason: "no_candidates" });
    expect(rankMealSuggestions([c("Büyük", 900, 50)], REMAINING)).toEqual({ suggestions: [], reason: "none_fit" });
  });

  it("eşit puanda ada göre sıralar; sınır küçük bir pay (%5) tanır", () => {
    const { suggestions } = rankMealSuggestions([c("Börek", 400, 20), c("Ayran", 400, 20), c("Sınırda", 730, 10)], REMAINING);
    expect(suggestions.map((s) => s.name)).toEqual(["Sınırda", "Ayran", "Börek"]);
  });
});
