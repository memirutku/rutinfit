import type { MealType } from "./schemas/enums";

/** Günün saatine göre öğün (panodaki ritim kartıyla aynı sınırlar). */
export function mealTypeForHour(hour: number): MealType {
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 19) return "workSnack";
  if (hour < 22) return "dinner";
  return "extra";
}
