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
  workSnack: "İş Çıkışı Ara Öğünü",
  dinner: "Akşam Yemeği",
  extra: "Ekstra / Ara Öğün",
};
