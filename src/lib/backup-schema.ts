import { z } from "zod";

export const SUPPORTED_BACKUP_VERSIONS = ["1.0", "1.1", "2.0"] as const;

/**
 * Yedek zarfı. Satır düzeyinde doğrulama şemadan türetilerek
 * lib/services/backup.ts içinde yapılır (her tablo ve alan için tip kontrolü).
 */
export const BackupEnvelopeSchema = z.object({
  version: z.string().refine((v) => (SUPPORTED_BACKUP_VERSIONS as readonly string[]).includes(v), {
    message: `Desteklenmeyen yedek sürümü. Desteklenen sürümler: ${SUPPORTED_BACKUP_VERSIONS.join(", ")}`,
  }),
  exportedAt: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

export type BackupEnvelope = z.infer<typeof BackupEnvelopeSchema>;
