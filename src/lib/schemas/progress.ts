import { z } from "zod";

/** POST /api/progress: kilo, iyilik hali ve kreatin kaydı (gönderilen alanlar güncellenir). */
export const ProgressLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().positive().optional(),
  waistCm: z.number().positive().optional(),
  energy1to5: z.number().int().min(1).max(5).optional(),
  hunger1to5: z.number().int().min(1).max(5).optional(),
  sleepMinutes: z.number().int().nonnegative().optional(),
  stress1to5: z.number().int().min(1).max(5).optional(),
  /** F51 */
  soreness1to5: z.number().int().min(1).max(5).optional(),
  mood1to5: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  creatineTaken: z.boolean().optional(),
  creatineDoseGrams: z.number().positive().default(5.0),
});
export type ProgressLogInput = z.input<typeof ProgressLogSchema>;

export const WellbeingSchema = z.object({
  id: z.string(),
  date: z.string(),
  energy1to5: z.number(),
  hunger1to5: z.number(),
  sleepMinutes: z.number(),
  stress1to5: z.number(),
  notes: z.string().nullable(),
});

/** GET /api/progress */
export const ProgressResponseSchema = z.object({
  weights: z.array(z.object({ date: z.string(), weightKg: z.number(), rollingAvg: z.number() })),
  wellbeings: z.array(WellbeingSchema),
  measurements: z.array(z.object({ id: z.string(), date: z.string(), waistCm: z.number() })),
  creatineCompliance: z.array(z.object({ date: z.string(), taken: z.boolean() })),
  weeklyWeightDelta: z.number(),
  today: z.object({
    date: z.string(),
    creatineTaken: z.boolean(),
    weightKg: z.number().nullable(),
    energy1to5: z.number().nullable(),
    sleepMinutes: z.number().nullable(),
    hunger1to5: z.number().nullable(),
    /** F51 */
    stress1to5: z.number().nullable().optional(),
    soreness1to5: z.number().nullable().optional(),
    mood1to5: z.number().nullable().optional(),
  }),
});
export type ProgressResponse = z.infer<typeof ProgressResponseSchema>;

/* F23 / F24: antrenman istatistikleri (yanıt tipleri lib'deki hesaplardan gelir). */
import type { ExerciseDay, PersonalRecords, Plateau } from "../strength";
import type { WeeklyVolume } from "../muscle-volume";
export type { ExerciseDay, PersonalRecords };
export interface StrengthExercise {
  name: string;
  sessions: number;
  lastDate: string;
  bestE1rm: number;
}
export interface StrengthList {
  exercises: StrengthExercise[];
}
export interface StrengthDetail {
  name: string;
  history: ExerciseDay[];
  prs: PersonalRecords;
  plateau?: Plateau | null;
}
export interface WeeklyVolumeResponse extends WeeklyVolume {
  target: { min: number; max: number };
}
