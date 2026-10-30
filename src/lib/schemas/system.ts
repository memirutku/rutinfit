import { z } from "zod";

/** POST /api/ai/test-connection */
export const TestConnectionSchema = z.object({
  providerType: z.enum(["ollama", "lmstudio", "openai"]),
  baseUrl: z.string().url(),
  modelName: z.string().optional(),
});
export type TestConnectionInput = z.infer<typeof TestConnectionSchema>;

export const TestConnectionResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  models: z.array(z.string()).optional(),
});
export type TestConnectionResult = z.infer<typeof TestConnectionResultSchema>;

/** GET /api/opengym/status (çevrimdışıyken 500 + { isOnline: false, error }) */
export const OpenGymStatusSchema = z.object({
  isOnline: z.boolean(),
  url: z.string().optional(),
  version: z.string().optional(),
  error: z.string().optional(),
  localStateFound: z.boolean().optional(),
  stats: z.object({ workoutCount: z.number(), weightCount: z.number() }).optional(),
});
export type OpenGymStatus = z.infer<typeof OpenGymStatusSchema>;

/** POST /api/opengym/sync */
export const OpenGymSyncResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  importedWorkouts: z.number().optional(),
  syncedWeights: z.number().optional(),
});
export type OpenGymSyncResult = z.infer<typeof OpenGymSyncResultSchema>;

/** GET /api/diagnostics */
export const DiagnosticsSchema = z.object({
  storage: z.object({
    dbPath: z.string(),
    dbSizeFormatted: z.string(),
    backupsDir: z.string(),
    backupCount: z.number(),
  }),
  counts: z.object({
    foods: z.number(),
    foodLogs: z.number(),
    recipes: z.number(),
    mealPlans: z.number(),
    workoutSessions: z.number(),
    setLogs: z.number(),
    weightLogs: z.number(),
    pantryItems: z.number(),
  }),
  system: z.object({
    nodeVersion: z.string(),
    platform: z.string(),
    arch: z.string(),
    memoryRssMb: z.number(),
  }),
});
export type Diagnostics = z.infer<typeof DiagnosticsSchema>;

/** POST /api/backup/import */
export const BackupImportResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  counts: z.record(z.string(), z.number()).optional(),
});
export type BackupImportResult = z.infer<typeof BackupImportResultSchema>;
