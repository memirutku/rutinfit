/**
 * B42: yerel model yokken yapay zekâsız öğün önerisi. Kullanıcının kayıtlı öğünleri ve tarifleri,
 * bugün kalan kalori ve makrolara göre açık kurallarla sıralanır:
 *  - kalan kaloriyi (küçük bir payla) aşan öneri elenir;
 *  - kalan proteinin ne kadarını karşıladığı ve kalan kaloriyi ne kadar kullandığı puanlanır;
 *  - kalan yağı ya da karbonhidratı aşan öneri geri düşer.
 */
export interface MealCandidate {
  id: string;
  source: "saved_meal" | "recipe";
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface RemainingMacros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealSuggestion extends MealCandidate {
  /** Kalan kalorinin kullanılan payı (0–1,05). */
  kcalShare: number;
  /** Kalan proteinin karşılanan payı (0–1); kalan protein yoksa 0. */
  proteinShare: number;
  score: number;
}

export type NoSuggestionReason = "no_remaining" | "no_candidates" | "none_fit";

export interface MealSuggestionResult {
  suggestions: MealSuggestion[];
  reason?: NoSuggestionReason;
}

/** Bu kadardan az kalori kaldıysa öğün önerilmez. */
export const MIN_REMAINING_KCAL = 50;
/** Kalan kaloriyi bu oranda aşan öneri hâlâ "sığar" sayılır. */
const KCAL_TOLERANCE = 1.05;

const share = (value: number, of: number) => (of > 0 ? value / of : 0);
/** Kalan miktarı aşma oranı (0–1); hiç kalmamışsa her miktar tam aşımdır. */
const overage = (value: number, remaining: number) =>
  remaining > 0 ? Math.min(1, Math.max(0, value - remaining) / remaining) : value > 0 ? 1 : 0;

export function rankMealSuggestions(candidates: MealCandidate[], remaining: RemainingMacros, limit = 3): MealSuggestionResult {
  if (remaining.calories < MIN_REMAINING_KCAL) return { suggestions: [], reason: "no_remaining" };
  const known = candidates.filter((c) => c.calories > 0);
  if (!known.length) return { suggestions: [], reason: "no_candidates" };
  const fitting = known.filter((c) => c.calories <= remaining.calories * KCAL_TOLERANCE);
  if (!fitting.length) return { suggestions: [], reason: "none_fit" };

  const scored = fitting.map((c): MealSuggestion => {
    const kcalShare = share(c.calories, remaining.calories);
    const proteinShare = Math.min(1, share(c.proteinG, remaining.proteinG));
    const over = (overage(c.fatG, remaining.fatG) + overage(c.carbsG, remaining.carbsG)) / 2;
    const score = 0.55 * proteinShare + 0.45 * Math.min(1, kcalShare) - 0.3 * over;
    return { ...c, kcalShare, proteinShare, score };
  });
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "tr"));
  return { suggestions: scored.slice(0, limit) };
}
