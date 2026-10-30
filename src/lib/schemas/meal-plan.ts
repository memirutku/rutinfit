import { z } from "zod";
import { MealTypeSchema } from "./enums";
import { MacrosSchema, RecipeSchema } from "./food";

/** POST /api/meal-plans: tek planlı öğün */
export const PlannedMealInputSchema = z.object({
  mealType: MealTypeSchema,
  recipeId: z.string().optional().nullable(),
  customName: z.string().optional().nullable(),
  plannedTime: z.string().optional().nullable(),
  servings: z.number().positive().default(1),
  isCompleted: z.boolean().default(false),
});

/** POST /api/meal-plans */
export const SaveMealPlanSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  meals: z.array(PlannedMealInputSchema),
});

export const PlannedMealSchema = z.object({
  id: z.string(),
  mealType: z.string(),
  recipeId: z.string().nullable(),
  customName: z.string().nullable(),
  servings: z.number(),
  isCompleted: z.boolean(),
  /** F78: uygulandı / kısmen / atlandı (işaretlenmemişse null). */
  adherence: z.enum(["done", "partial", "skipped"]).nullable().optional(),
  recipe: RecipeSchema.omit({ calculatedMacros: true }).nullable(),
  /** Planlanan porsiyonun katalogdan hesaplanan makroları (tarif yoksa null). */
  calculatedMacros: MacrosSchema.nullable(),
});
export type PlannedMeal = z.infer<typeof PlannedMealSchema>;

/** GET /api/meal-plans?date= öğesi */
export const MealPlanSchema = z.object({
  id: z.string(),
  date: z.string(),
  notes: z.string().nullable(),
  meals: z.array(PlannedMealSchema),
});
export type MealPlan = z.infer<typeof MealPlanSchema>;
