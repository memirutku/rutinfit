import { z } from "zod";
import { isDateString } from "../date-utils";

/** POST /api/pantry: ekle veya (id ile) güncelle */
export const PantryItemInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, "Ürün adı zorunludur.").max(120),
  amount: z.number().finite().nonnegative("Miktar negatif olamaz."),
  unit: z.string().trim().min(1).max(20).optional(),
  category: z.string().trim().max(60).optional(),
  expiryDate: z
    .string()
    .refine((v) => v === "" || isDateString(v), "Son kullanma tarihi YYYY-AA-GG olmalıdır.")
    .nullable()
    .optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type PantryItemInput = z.input<typeof PantryItemInputSchema>;

/** PATCH /api/pantry: ± düğmeleri (atomik artırım) */
export const PantryAdjustSchema = z.object({
  id: z.string().min(1),
  delta: z.number().finite(),
});

export const PantryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
  unit: z.string(),
  category: z.string(),
  expiryDate: z.string().nullable(),
  notes: z.string().nullable(),
});
export type PantryItem = z.infer<typeof PantryItemSchema>;

/** GET /api/pantry */
export const PantryResponseSchema = z.object({ items: z.array(PantryItemSchema) });
export type PantryResponse = z.infer<typeof PantryResponseSchema>;

/** POST/PATCH /api/pantry yanıtı */
export const PantryItemResultSchema = z.object({ success: z.boolean(), item: PantryItemSchema });
export type PantryItemResult = z.infer<typeof PantryItemResultSchema>;
