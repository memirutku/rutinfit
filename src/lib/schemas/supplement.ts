import { z } from "zod";

/** F15: Takviye doz birimleri. */
export const SUPPLEMENT_UNITS = ["g", "mg", "mcg", "IU", "kapsül", "tablet", "damla", "ml", "ölçek"] as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SupplementInputSchema = z.object({
  name: z.string().trim().min(1, "Takviye adı gerekli.").max(80),
  doseAmount: z.number().positive("Doz 0'dan büyük olmalı.").max(100000),
  doseUnit: z.enum(SUPPLEMENT_UNITS),
  active: z.boolean().optional(),
  notes: z.string().trim().max(200).nullable().optional(),
});
export type SupplementInput = z.infer<typeof SupplementInputSchema>;

export const SupplementPatchSchema = SupplementInputSchema.partial();

export const SupplementLogInputSchema = z.object({
  supplementId: z.string().min(1),
  date: date.optional(),
  taken: z.boolean(),
});

export interface SupplementView {
  id: string;
  name: string;
  doseAmount: number;
  doseUnit: string;
  active: boolean;
  notes: string | null;
  takenToday: boolean;
  takenLast7: number;
}
