import { z } from "zod";
import { DRINK_KINDS } from "../drinks";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** POST /api/drinks: hazır içecek (presetId) ya da serbest kayıt (kind + ml). */
export const DrinkInputSchema = z
  .object({
    date: date.optional(),
    time: time.optional(),
    presetId: z.string().min(1).optional(),
    kind: z.enum(DRINK_KINDS).optional(),
    name: z.string().trim().min(1).max(60).optional(),
    ml: z.number().positive().max(5000).optional(),
    caffeineMg: z.number().nonnegative().max(1000).optional(),
    alcoholG: z.number().nonnegative().max(200).optional(),
    kcal: z.number().nonnegative().max(3000).optional(),
    carbsG: z.number().nonnegative().max(500).optional(),
    proteinG: z.number().nonnegative().max(200).optional(),
    /** F79: çay / Türk kahvesine eklenen küp şeker (yarım küp olabilir). */
    sugarCubes: z.number().min(0).max(6).multipleOf(0.5).optional(),
  })
  .refine((v) => v.presetId || (v.kind && v.ml), { message: "Hazır içecek ya da tür ve miktar gerekli." });
export type DrinkInput = z.input<typeof DrinkInputSchema>;

export const DrinkLogSchema = z.object({
  id: z.string(),
  date: z.string(),
  time: z.string(),
  kind: z.enum(DRINK_KINDS),
  name: z.string(),
  ml: z.number(),
  caffeineMg: z.number(),
  alcoholG: z.number(),
  kcal: z.number(),
  foodLogId: z.string().nullable(),
});
export type DrinkLog = z.infer<typeof DrinkLogSchema>;

/** GET /api/drinks?date= */
export const DrinksDaySchema = z.object({
  date: z.string(),
  logs: z.array(DrinkLogSchema),
  summary: z.object({
    hydrationMl: z.number(),
    waterTargetMl: z.number(),
    progressPercent: z.number(),
    caffeineMg: z.number(),
    caffeineHigh: z.boolean(),
    alcoholG: z.number(),
    standardDrinks: z.number(),
  }),
});
export type DrinksDay = z.infer<typeof DrinksDaySchema>;
