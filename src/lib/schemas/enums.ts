import { z } from "zod";

/** Uygulamanın tek öğün tipi listesi. "snack" eski/AI girişleri için "extra"nın takma adıdır. */
export const MEAL_TYPES = ["breakfast", "lunch", "workSnack", "dinner", "extra"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MealTypeSchema = z.preprocess(
  (v) => (v === "snack" ? "extra" : v),
  z.enum(MEAL_TYPES)
);

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Kahvaltı",
  lunch: "Öğle Yemeği",
  workSnack: "İkindi Ara Öğünü",
  dinner: "Akşam Yemeği",
  extra: "Ekstra / Ara Öğün",
};

/** F76: Ramazan modunda kahvaltı "Sahur", akşam yemeği "İftar" olarak gösterilir (kayıt türü aynı kalır). */
export function mealTypeLabel(type: MealType, ramadan = false): string {
  if (ramadan && type === "breakfast") return "Sahur";
  if (ramadan && type === "dinner") return "İftar";
  return MEAL_TYPE_LABELS[type];
}

/** F82: Günlük döngü notu (isteğe bağlı). */
export const CYCLE_NOTES = ["period_start", "period", "spotting"] as const;
export type CycleNote = (typeof CYCLE_NOTES)[number];
export const CYCLE_NOTE_LABELS: Record<CycleNote, string> = {
  period_start: "Adet başladı",
  period: "Adet",
  spotting: "Lekelenme",
};
