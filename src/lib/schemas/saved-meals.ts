import { z } from "zod";
import { MealTypeSchema } from "./enums";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** POST /api/saved-meals: bir günün öğününü kaydeder. */
export const SaveMealInputSchema = z.object({
  name: z.string().trim().min(1, "Ad zorunludur.").max(80),
  date,
  mealType: MealTypeSchema,
});
export type SaveMealInput = z.input<typeof SaveMealInputSchema>;

/** POST /api/saved-meals/apply */
export const ApplySavedMealInputSchema = z.object({
  savedMealId: z.string().min(1),
  date,
  mealType: MealTypeSchema.optional(),
  time: time.optional(),
});
export type ApplySavedMealInput = z.input<typeof ApplySavedMealInputSchema>;

/** POST /api/food-logs/copy */
export const CopyFoodLogsInputSchema = z.object({
  fromDate: date,
  toDate: date,
  mealType: MealTypeSchema.optional(),
});
export type CopyFoodLogsInput = z.input<typeof CopyFoodLogsInputSchema>;

export const SavedMealSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  mealType: z.string().nullable(),
  itemCount: z.number(),
  totalCalories: z.number(),
  items: z.array(z.object({ name: z.string(), grams: z.number() })),
});
export type SavedMealSummary = z.infer<typeof SavedMealSummarySchema>;
