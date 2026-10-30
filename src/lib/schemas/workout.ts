import { z } from "zod";

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
});
export type ProgressionFeedback = z.infer<typeof ProgressionFeedbackSchema>;

/** POST /api/workouts yanıtı */
export const FinishWorkoutResponseSchema = z.object({
  session: WorkoutSessionSchema,
  progressionFeedbacks: z.record(z.string(), ProgressionFeedbackSchema),
});
export type FinishWorkoutResponse = z.infer<typeof FinishWorkoutResponseSchema>;
