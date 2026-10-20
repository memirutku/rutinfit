import { z } from "zod";
import { MealTypeSchema } from "./schemas/enums";

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

// --- Draft Types & Schemas (7 Distinct Types) ---

export const PlannedMealItemSchema = z.object({
  mealType: MealTypeSchema.default("extra"),
  recipeId: z.string().optional().nullable(),
  customName: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  plannedTime: z.string().optional().nullable(),
  servings: z.number().positive().default(1),
});

export const MealPlanDraftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz tarih formatı (YYYY-MM-DD)").optional(),
  notes: z.string().optional().nullable(),
  // Varsayılan boş liste YOK: verilmezse günün mevcut öğünlerine dokunulmaz.
  meals: z.array(PlannedMealItemSchema).optional(),
  /** true ise günün öğünleri bu listeyle değiştirilir; aksi halde eklenir. */
  replaceMeals: z.boolean().optional().default(false),
});

/** AI öğün önerisi: onaylanınca o günün planına tarifli öğün olarak eklenir. */
export const PlannedMealDraftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mealType: MealTypeSchema.default("dinner"),
  title: z.string().min(1, "Öğün adı boş olamaz"),
  rationale: z.string().optional().default(""),
  prepMinutes: z.number().int().positive().default(15),
  ingredients: z
    .array(
      z.object({
        foodItemId: z.string().optional().nullable(),
        foodName: z.string().min(1),
        grams: z.number().positive(),
      })
    )
    .min(1, "En az bir malzeme gerekir"),
});

export const FoodLogDraftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().optional(),
  mealType: MealTypeSchema.default("extra"),
  name: z.string().min(1, "Besin adı boş olamaz"),
  grams: z.number().positive("Gram miktarı pozitif olmalıdır"),
  calories: z.number().nonnegative().optional(),
  proteinG: z.number().nonnegative().optional(),
  carbsG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
  foodItemId: z.string().optional().nullable(),
});

export const RecipeIngredientDraftSchema = z.object({
  foodItemId: z.string().min(1),
  grams: z.number().positive(),
});

export const RecipeDraftSchema = z.object({
  name: z.string().min(1, "Tarif adı boş olamaz"),
  instructions: z.string().optional().default(""),
  prepMinutes: z.number().int().nonnegative().default(15),
  servings: z.number().int().positive().default(1),
  ingredients: z.array(RecipeIngredientDraftSchema).optional().default([]),
});

// Profil sütunları tam sayıdır; kesirli değerler yuvarlanır (aksi halde Prisma hatası).
const intTarget = (schema: z.ZodNumber) => schema.transform((v) => Math.round(v));

export const NutritionTargetDraftSchema = z.object({
  calorieTarget: intTarget(z.number().positive("Kalori hedefi pozitif olmalıdır")),
  calorieCeiling: intTarget(z.number().positive()).optional(),
  proteinTargetG: intTarget(z.number().nonnegative("Protein hedefi negatif olamaz")),
  fatTargetG: intTarget(z.number().nonnegative("Yağ hedefi negatif olamaz")),
  carbTargetG: intTarget(z.number().nonnegative("Karbonhidrat hedefi negatif olamaz")),
});

export const SetLogDraftSchema = z.object({
  exerciseName: z.string().min(1, "Egzersiz adı boş olamaz"),
  setNumber: z.number().int().positive().optional(),
  weightKg: z.number().nonnegative().default(0),
  reps: z.number().int().positive().default(10),
  rpe: z.number().min(1).max(10).optional().nullable(),
});

export const WorkoutSessionDraftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  name: z.string().min(1, "Antrenman adı boş olamaz"),
  durationMinutes: z.number().int().positive().default(45),
  rpe: z.number().min(1).max(10).optional().nullable(),
  sets: z.array(SetLogDraftSchema).optional().default([]),
  /** AI önerisi planlanmış seanstır; kullanıcı yapınca tamamlanır. */
  completed: z.boolean().optional().default(false),
});

export const WeightWellbeingDraftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weightKg: z.number().positive("Kilo pozitif olmalıdır").optional(),
  energy1to5: z.number().int().min(1).max(5).optional(),
  hunger1to5: z.number().int().min(1).max(5).optional(),
  sleepMinutes: z.number().int().nonnegative().optional(),
  stress1to5: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional().nullable(),
});

export const BulkImportDraftSchema = z.object({
  importSource: z.string().optional(),
  itemsCount: z.number().int().nonnegative().optional(),
  records: z.array(z.record(z.any())).optional(),
});

export const DraftSchemas = {
  meal_plan: MealPlanDraftSchema,
  planned_meal: PlannedMealDraftSchema,
  food_log: FoodLogDraftSchema,
  recipe: RecipeDraftSchema,
  nutrition_targets: NutritionTargetDraftSchema,
  workout_session: WorkoutSessionDraftSchema,
  weight_wellbeing: WeightWellbeingDraftSchema,
  bulk_import: BulkImportDraftSchema,
} as const;

export type DraftType = keyof typeof DraftSchemas;

export function validateDraftChanges(draftType: DraftType, data: unknown): any {
  const schema = DraftSchemas[draftType];
  if (!schema) {
    throw new Error(`Bilinmeyen taslak türü: ${draftType}`);
  }
  return schema.parse(data);
}
