import { z } from "zod";
import { MealTypeSchema } from "./enums";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** F31: serbest porsiyon (0,25–20). */
const servings = z.number().min(0.25).max(20);

/** F30: POST /api/meal-plans/meals */
export const PlannedMealCreateSchema = z
  .object({
    date,
    mealType: MealTypeSchema,
    recipeId: z.string().min(1).optional().nullable(),
    customName: z.string().trim().min(1).max(120).optional().nullable(),
    plannedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
    servings: servings.default(1),
  })
  .refine((v) => v.recipeId || v.customName, { message: "Tarif ya da öğün adı gerekli." });

/** F30: PATCH /api/meal-plans/meals?id= (taşıma ve düzenleme) */
export const PlannedMealUpdateSchema = z.object({
  date: date.optional(),
  mealType: MealTypeSchema.optional(),
  recipeId: z.string().min(1).optional().nullable(),
  customName: z.string().trim().min(1).max(120).optional().nullable(),
  servings: servings.optional(),
  /** Recheck: "Yedim" ile günlüğe yazıldı (true) ya da işaret kaldırıldı (false). */
  logged: z.boolean().optional(),
});

/** F30: POST /api/meal-plans/meals/copy */
export const PlannedMealCopySchema = z.object({ id: z.string().min(1), toDate: date, toMealType: MealTypeSchema.optional() });
