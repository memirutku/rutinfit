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

export const ShoppingListItemSchema = z.object({
  id: z.string(),
  weekStart: z.string(),
  category: z.string(),
  name: z.string(),
  amount: z.number(),
  unit: z.string(),
  checked: z.boolean(),
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
});
export type ShoppingList = z.infer<typeof ShoppingListSchema>;

/** Kalemleri kategoriye göre gruplar (sunucudaki sıralama korunur). */
export function groupShoppingItems(items: ShoppingListItem[]): Record<string, ShoppingListItem[]> {
  const grouped: Record<string, ShoppingListItem[]> = {};
  for (const item of items) (grouped[item.category] ??= []).push(item);
  return grouped;
}
