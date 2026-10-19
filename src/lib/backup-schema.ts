import { z } from "zod";

export const SUPPORTED_BACKUP_VERSIONS = ["1.0", "1.1"] as const;

export const BackupEnvelopeSchema = z.object({
  version: z.string().refine((v) => (SUPPORTED_BACKUP_VERSIONS as readonly string[]).includes(v), {
    message: `Desteklenmeyen yedek sürümü. Desteklenen sürümler: ${SUPPORTED_BACKUP_VERSIONS.join(", ")}`,
  }),
  exportedAt: z.string().optional(),
  data: z.object({
    profile: z.any().optional().nullable(),
    foods: z.array(z.any()).optional().default([]),
    recipes: z.array(z.any()).optional().default([]),
    mealPlans: z.array(z.any()).optional().default([]),
    foodLogs: z.array(z.any()).optional().default([]),
    workoutTemplates: z.array(z.any()).optional().default([]),
    workoutSessions: z.array(z.any()).optional().default([]),
    weightLogs: z.array(z.any()).optional().default([]),
    measurements: z.array(z.any()).optional().default([]),
    wellbeings: z.array(z.any()).optional().default([]),
    supplementLogs: z.array(z.any()).optional().default([]),
    shoppingListItems: z.array(z.any()).optional().default([]),
    pantryItems: z.array(z.any()).optional().default([]),
    aiSettings: z.any().optional().nullable(),
  }),
});

export type BackupEnvelope = z.infer<typeof BackupEnvelopeSchema>;
