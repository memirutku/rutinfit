import { z } from "zod";

/** B36: POST /api/system/reveal — tam yol ya da İndirilenler'deki dosya adı. */
export const RevealRequestSchema = z.union([
  z.object({ path: z.string().min(1).max(4096) }).strict(),
  z.object({ download: z.string().min(1).max(255) }).strict(),
]);
export type RevealRequest = z.infer<typeof RevealRequestSchema>;

export const RevealResultSchema = z.object({ ok: z.literal(true), path: z.string() });
export type RevealResult = z.infer<typeof RevealResultSchema>;

/** B36: POST /api/system/choose-folder — seçilen klasör (vazgeçilirse null). */
export const ChooseFolderRequestSchema = z.object({ purpose: z.enum(["auto-backup"]).optional() }).strict();
export const ChooseFolderResultSchema = z.object({ path: z.string().nullable() });
export type ChooseFolderResult = z.infer<typeof ChooseFolderResultSchema>;
