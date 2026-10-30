import { z } from "zod";
import { isDateString } from "../date-utils";

/** POST /api/shopping: haftalık listeyi plandan yeniden kurar */
export const ShoppingGenerateSchema = z.object({
  weekStart: z.string().refine(isDateString, "weekStart YYYY-AA-GG olmalıdır.").optional(),
  deductPantry: z.boolean().default(true),
});

/** PUT /api/shopping: kalem işareti */
export const ShoppingToggleSchema = z.object({ id: z.string().min(1), checked: z.boolean() });
export type ShoppingToggleInput = z.infer<typeof ShoppingToggleSchema>;

/** B09: POST /api/shopping/items — kullanıcının elle eklediği kalem (reyon verilmezse adından bulunur). */
export const ShoppingManualItemSchema = z.object({
  weekStart: z.string().refine(isDateString, "weekStart YYYY-AA-GG olmalıdır."),
  name: z.string().trim().min(1, "Kalem adı boş olamaz.").max(80),
  amount: z.number().finite().positive("Miktar sıfırdan büyük olmalıdır.").max(100_000).default(1),
  unit: z.string().trim().min(1).max(20).default("adet"),
  category: z.string().trim().min(1).max(60).optional(),
});
export type ShoppingManualItemInput = z.input<typeof ShoppingManualItemSchema>;

export const ShoppingListItemSchema = z.object({
  id: z.string(),
  weekStart: z.string(),
  category: z.string(),
  name: z.string(),
  amount: z.number(),
  unit: z.string(),
  checked: z.boolean(),
  /** B09: elle eklenen kalem (plandan yenilemede silinmez). */
  manual: z.boolean().optional(),
});
export type ShoppingListItem = z.infer<typeof ShoppingListItemSchema>;

/** GET ve POST /api/shopping yanıtı */
export const ShoppingListSchema = z.object({
  weekStart: z.string(),
  items: z.array(ShoppingListItemSchema),
  grouped: z.record(z.string(), z.array(ShoppingListItemSchema)),
  /** Yalnız GET: bu hafta için liste kurulmuş mu */
  generated: z.boolean().optional(),
  /** Yalnız POST: kiler düşümü özeti */
  pantrySummary: z.string().optional(),
  /** B09: haftadaki planlı öğün sayısı ve tarife bağlı olmadığı için malzemesi listeye girmeyenlerin adları. */
  plannedMeals: z.number().optional(),
  unlinkedMeals: z.array(z.string()).optional(),
});
export type ShoppingList = z.infer<typeof ShoppingListSchema>;

/** Kalemleri kategoriye göre gruplar (sunucudaki sıralama korunur). */
export function groupShoppingItems(items: ShoppingListItem[]): Record<string, ShoppingListItem[]> {
  const grouped: Record<string, ShoppingListItem[]> = {};
  for (const item of items) (grouped[item.category] ??= []).push(item);
  return grouped;
}
