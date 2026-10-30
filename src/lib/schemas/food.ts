import { z } from "zod";
import { MealTypeSchema } from "./enums";

/* ------------------------------------------------------------------ */
/* İstek şemaları (route'lar doğrular, istemci tipleri buradan türer)  */
/* ------------------------------------------------------------------ */

const barcodeDigits = z.string().transform((v) => v.replace(/[^0-9]/g, ""));

/** POST /api/foods */
export const FoodItemInputSchema = z.object({
  name: z.string().min(1),
  category: z.string().default("Genel"),
  basisGrams: z.number().positive().default(100),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  source: z.string().default("Kullanıcı"),
  // B14: elle eklenen besinin güveni kullanıcının beyanıdır.
  confidence: z.string().default("Kullanıcı"),
  brand: z.string().trim().max(120).optional().nullable(),
  barcode: barcodeDigits
    .refine((v) => v.length === 0 || (v.length >= 6 && v.length <= 14), "Barkod 6–14 haneli olmalıdır.")
    .transform((v) => v || null)
    .optional()
    .nullable(),
});
export type FoodItemInput = z.input<typeof FoodItemInputSchema>;

/** POST /api/recipes */
export const RecipeIngredientInputSchema = z.object({
  foodItemId: z.string().min(1),
  grams: z.number().positive(),
});

export const RecipeInputSchema = z.object({
  name: z.string().min(1),
  instructions: z.string().optional(),
  prepMinutes: z.number().int().positive().default(15),
  servings: z.number().int().positive().default(1),
  tags: z.array(z.string()).optional(),
  ingredients: z.array(RecipeIngredientInputSchema).min(1),
});
export type RecipeInput = z.input<typeof RecipeInputSchema>;

/** POST /api/food-logs */
export const FoodLogCreateSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().default("12:00"),
    mealType: MealTypeSchema,
    foodItemId: z.string().optional().nullable(),
    recipeId: z.string().optional().nullable(),
    name: z.string().min(1),
    /** Gram ya da (tarif için) porsiyon sayısı verilmelidir. B09: serbest kayıtta kalori yeterlidir (gram 0 = bilinmiyor). */
    grams: z.number().nonnegative().optional(),
    servings: z.number().positive().optional(),
    caloriesSnapshot: z.number().nonnegative().optional(),
    proteinSnapshot: z.number().nonnegative().optional(),
    carbsSnapshot: z.number().nonnegative().optional(),
    fatSnapshot: z.number().nonnegative().optional(),
  })
  .refine(
    (v) =>
      v.grams !== undefined ||
      (v.servings !== undefined && !!v.recipeId) ||
      (!v.foodItemId && !v.recipeId && v.caloriesSnapshot !== undefined),
    { message: "grams, (tarif için) servings ya da (serbest kayıtta) kalori zorunludur.", path: ["grams"] }
  );
export type FoodLogCreateInput = z.input<typeof FoodLogCreateSchema>;

/** PATCH /api/food-logs?id= (B13: kaydın öğünü sonradan değiştirilir). */
export const FoodLogPatchSchema = z.object({ mealType: MealTypeSchema });
export type FoodLogPatchInput = z.input<typeof FoodLogPatchSchema>;

/** POST /api/foods/barcode: Open Food Facts ürününü yerel kataloğa kaydeder. */
export const PackagedProductSaveSchema = z.object({
  barcode: barcodeDigits
    .refine((v) => v.length >= 6 && v.length <= 14, "Barkod 6–14 haneli olmalıdır.")
    .optional()
    .nullable(),
  name: z.string().trim().min(1, "Ürün adı zorunludur.").max(200),
  brand: z.string().trim().max(120).optional().nullable(),
  basisGrams: z.number().positive().default(100),
  calories: z.number().finite().nonnegative(),
  proteinG: z.number().finite().nonnegative(),
  carbsG: z.number().finite().nonnegative().default(0),
  fatG: z.number().finite().nonnegative().default(0),
  category: z.string().trim().max(60).default("Paketli Gıda"),
  confidence: z.string().max(30).default("Yüksek"),
});
export type PackagedProductSaveInput = z.input<typeof PackagedProductSaveSchema>;

/* ------------------------------------------------------------------ */
/* Yanıt şemaları (istemci tipleri; tests/api/response-schemas sınar)  */
/* ------------------------------------------------------------------ */

export const MacrosSchema = z.object({
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
});
export type Macros = z.infer<typeof MacrosSchema>;

export const FoodItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  brand: z.string().nullable(),
  barcode: z.string().nullable(),
  basisGrams: z.number(),
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  source: z.string(),
  confidence: z.string(),
});
export type FoodItem = z.infer<typeof FoodItemSchema>;

export const RecipeIngredientSchema = z.object({
  id: z.string(),
  foodItemId: z.string(),
  grams: z.number(),
  foodItem: FoodItemSchema,
});

export const RecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  instructions: z.string().nullable(),
  prepMinutes: z.number(),
  servings: z.number(),
  ingredients: z.array(RecipeIngredientSchema),
  /** GET /api/recipes katalogdan hesaplar; POST yanıtında yoktur. */
  calculatedMacros: MacrosSchema.optional(),
});
export type Recipe = z.infer<typeof RecipeSchema>;

export const FoodLogSchema = z.object({
  id: z.string(),
  date: z.string(),
  time: z.string(),
  mealType: z.string(),
  foodItemId: z.string().nullable(),
  recipeId: z.string().nullable(),
  name: z.string(),
  grams: z.number(),
  caloriesSnapshot: z.number(),
  proteinSnapshot: z.number(),
  carbsSnapshot: z.number(),
  fatSnapshot: z.number(),
});
export type FoodLog = z.infer<typeof FoodLogSchema>;

export const DailyTargetsSchema = z.object({
  calorieTarget: z.number(),
  calorieCeiling: z.number(),
  proteinTargetG: z.number(),
  fatTargetG: z.number(),
  carbTargetG: z.number(),
});

export const DailySummarySchema = z.object({
  consumedCalories: z.number(),
  consumedProtein: z.number(),
  consumedCarbs: z.number(),
  consumedFat: z.number(),
  remainingCalories: z.number(),
  remainingProtein: z.number(),
  remainingCarbs: z.number(),
  remainingFat: z.number(),
  progressPercent: z.object({ calories: z.number(), protein: z.number(), carbs: z.number(), fat: z.number() }),
  ceilingAlert: z.object({
    isApproaching: z.boolean(),
    isExceeded: z.boolean(),
    diffFromCeiling: z.number(),
    message: z.string().nullable(),
  }),
});
export type DailySummary = z.infer<typeof DailySummarySchema>;

/** GET /api/food-logs?date= */
export const FoodLogsResponseSchema = z.object({
  date: z.string(),
  logs: z.array(FoodLogSchema),
  summary: DailySummarySchema,
  targets: DailyTargetsSchema,
});
export type FoodLogsResponse = z.infer<typeof FoodLogsResponseSchema>;

/** Open Food Facts / yerel katalog ürünü (GET /api/foods/barcode). */
export const PackagedProductSchema = z.object({
  barcode: z.string().nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  basisGrams: z.number(),
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  confidence: z.string(),
  uncertainties: z.array(z.string()),
  categories: z.array(z.string()).optional(),
});
export type PackagedProduct = z.infer<typeof PackagedProductSchema>;

export const ProductSearchResponseSchema = z.object({
  product: PackagedProductSchema.optional(),
  products: z.array(PackagedProductSchema).optional(),
  notFound: z.boolean().optional(),
});
export type ProductSearchResponse = z.infer<typeof ProductSearchResponseSchema>;
