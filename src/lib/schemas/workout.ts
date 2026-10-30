import { z } from "zod";
import { SET_TYPES } from "../set-types";

/** POST /api/workouts: tek set kaydı */
export const SetLogInputSchema = z.object({
  exerciseName: z.string().min(1),
  setNumber: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  targetRepMin: z.number().int().positive().default(8),
  targetRepMax: z.number().int().positive().default(12),
  isTargetMet: z.boolean().default(false),
  /** F20: set başına RPE, 1–10, yarım puanlı. */
  rpe: z.number().min(1).max(10).multipleOf(0.5).optional().nullable(),
  /** F19: set tipi. */
  setType: z.enum(SET_TYPES).default("normal"),
});

/** POST /api/workouts */
export const WorkoutSessionInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  templateId: z.string().optional().nullable(),
  name: z.string().min(1),
  durationMinutes: z.number().int().nonnegative(),
  rpe: z.number().int().min(1).max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  completed: z.boolean().default(true),
  setLogs: z.array(SetLogInputSchema).optional().default([]),
});
export type WorkoutSessionInput = z.input<typeof WorkoutSessionInputSchema>;

export const WorkoutExerciseSchema = z.object({
  id: z.string(),
  exerciseName: z.string(),
  targetSets: z.number(),
  repMin: z.number(),
  repMax: z.number(),
  restSeconds: z.number(),
  orderIndex: z.number(),
  incrementKg: z.number().optional(),
});
export type WorkoutExercise = z.infer<typeof WorkoutExerciseSchema>;

export const WorkoutTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  dayOfWeek: z.number(),
  targetDurationMinutes: z.number(),
  notes: z.string().nullable(),
  exercises: z.array(WorkoutExerciseSchema),
});
export type WorkoutTemplate = z.infer<typeof WorkoutTemplateSchema>;

export const SetLogSchema = z.object({
  id: z.string(),
  exerciseName: z.string(),
  setNumber: z.number(),
  weightKg: z.number(),
  reps: z.number(),
  rpe: z.number().nullable().optional(),
  setType: z.string().optional(),
  isTargetMet: z.boolean(),
});

export const WorkoutSessionSchema = z.object({
  id: z.string(),
  date: z.string(),
  templateId: z.string().nullable(),
  name: z.string(),
  durationMinutes: z.number(),
  rpe: z.number().nullable(),
  notes: z.string().nullable(),
  completed: z.boolean(),
  setLogs: z.array(SetLogSchema),
});
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;

/** GET /api/workouts[?date=] */
export const WorkoutsResponseSchema = z.object({
  templates: z.array(WorkoutTemplateSchema),
  sessions: z.array(WorkoutSessionSchema),
});
export type WorkoutsResponse = z.infer<typeof WorkoutsResponseSchema>;

export const ProgressionFeedbackSchema = z.object({
  isTargetMetAllSets: z.boolean(),
  currentMaxWeight: z.number(),
  recommendedNextWeightKg: z.number(),
  message: z.string(),
  badge: z.enum(["progression", "maintain", "info"]),
  /** F21: son seanslarda yeni rekor yoksa. */
  plateau: z.object({ sessions: z.number(), bestE1rm: z.number(), message: z.string() }).nullable().optional(),
});
export type ProgressionFeedback = z.infer<typeof ProgressionFeedbackSchema>;

/** POST /api/workouts yanıtı */
export const FinishWorkoutResponseSchema = z.object({
  session: WorkoutSessionSchema,
  progressionFeedbacks: z.record(z.string(), ProgressionFeedbackSchema),
});
export type FinishWorkoutResponse = z.infer<typeof FinishWorkoutResponseSchema>;

/** F17: şablon egzersizi (şablon editörü). */
export const TemplateExerciseInputSchema = z
  .object({
    exerciseName: z.string().trim().min(1, "Egzersiz adı boş olamaz.").max(80),
    targetSets: z.number().int().min(1).max(10),
    repMin: z.number().int().min(1).max(100),
    repMax: z.number().int().min(1).max(100),
    restSeconds: z.number().int().min(0).max(600),
    /** F21: ilerlemede eklenecek ağırlık (kg). */
    incrementKg: z.number().min(0).max(20).default(2.5),
  })
  .refine((e) => e.repMin <= e.repMax, { message: "Tekrar alt sınırı üst sınırdan büyük olamaz.", path: ["repMin"] });

/** F17: POST/PUT /api/workouts/templates */
export const TemplateInputSchema = z.object({
  name: z.string().trim().min(1, "Şablon adı boş olamaz.").max(80),
  type: z.enum(["strength", "easy_run", "rest"]),
  dayOfWeek: z.number().int().min(1).max(7),
  // Dinlenme günü şablonlarının süresi 0 olabilir.
  targetDurationMinutes: z.number().int().min(0).max(240),
  notes: z.string().trim().max(300).optional().nullable(),
  exercises: z.array(TemplateExerciseInputSchema).max(20).default([]),
});
export type TemplateInput = z.input<typeof TemplateInputSchema>;
