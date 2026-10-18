import { z } from "zod";

export const MealProposalSchema = z.object({
  type: z.literal("meal_proposal"),
  mealType: z.enum(["breakfast", "lunch", "workSnack", "dinner", "snack"]),
  title: z.string().min(1),
  rationale: z.string(),
  prepMinutes: z.number().int().positive().default(15),
  ingredients: z.array(
    z.object({
      foodName: z.string().min(1),
      grams: z.number().positive(),
    })
  ),
  estimatedMacros: z.object({
    calories: z.number().nonnegative(),
    proteinG: z.number().nonnegative(),
    carbsG: z.number().nonnegative(),
    fatG: z.number().nonnegative(),
  }),
});

export const WorkoutAdjustmentSchema = z.object({
  type: z.literal("workout_adjustment"),
  title: z.string().min(1),
  targetDurationMinutes: z.number().int().positive(),
  reason: z.string(),
  exercises: z.array(
    z.object({
      exerciseName: z.string().min(1),
      sets: z.number().int().positive(),
      repMin: z.number().int().positive(),
      repMax: z.number().int().positive(),
      restSeconds: z.number().int().positive(),
    })
  ),
});

export const AIActionResponseSchema = z.discriminatedUnion("type", [
  MealProposalSchema,
  WorkoutAdjustmentSchema,
]);

export type MealProposal = z.infer<typeof MealProposalSchema>;
export type WorkoutAdjustment = z.infer<typeof WorkoutAdjustmentSchema>;
export type AIActionResponse = z.infer<typeof AIActionResponseSchema>;
