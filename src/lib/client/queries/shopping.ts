"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import { groupShoppingItems, type ShoppingList, type ShoppingListItem, type ShoppingManualItemInput } from "@/lib/schemas/shopping";

const generate = (weekStart: string) =>
  apiFetch<ShoppingList>("/api/shopping", { method: "POST", json: { weekStart, deductPantry: true } });

/**
 * Haftalık alışveriş listesi. GET salt-okunurdur; bu hafta için henüz liste kurulmadıysa
 * plandan bir kez (kiler düşülerek) oluşturulur.
 */
export function useShoppingList(weekStart: string) {
  return useQuery({
    queryKey: queryKeys.shopping.week(weekStart),
    queryFn: async () => {
      const list = await apiFetch<ShoppingList>(`/api/shopping?weekStart=${encodeURIComponent(weekStart)}`);
      return list.generated ? list : generate(weekStart);
    },
  });
}

/** Listeyi plandan yeniden kurar; yanıt (kiler özeti dahil) önbelleğe yazılır. */
export function useRegenerateShopping(weekStart: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => generate(weekStart),
    onSuccess: (list) => qc.setQueryData(queryKeys.shopping.week(weekStart), list),
  });
}

/** Önbellekteki listede bir kalemin işaretini değiştirir (gruplar yeniden kurulur). */
export function withItemChecked(list: ShoppingList, id: string, checked: boolean): ShoppingList {
  const items = list.items.map((i) => (i.id === id ? { ...i, checked } : i));
  return { ...list, items, grouped: groupShoppingItems(items) };
}

/**
 * Alışveriş kalemi işareti: iyimser güncelleme. Satır anında işaretlenir; sunucu hata
 * verirse önceki duruma döner. Liste yeniden çekilmez (kiler özeti korunur).
 */
export function useToggleShoppingItem(weekStart: string) {
  const qc = useQueryClient();
  const key = queryKeys.shopping.week(weekStart);
  return useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      apiFetch<ShoppingListItem>("/api/shopping", { method: "PUT", json: { id, checked } }),
    onMutate: async ({ id, checked }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ShoppingList>(key);
      if (previous) qc.setQueryData(key, withItemChecked(previous, id, checked));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
  });
}

/** Önbellekteki listeye kalem ekler ya da çıkarır (gruplar yeniden kurulur, kiler özeti korunur). */
function withItems(list: ShoppingList, items: ShoppingListItem[]): ShoppingList {
  const sorted = [...items].sort((a, b) => a.category.localeCompare(b.category, "tr") || a.name.localeCompare(b.name, "tr"));
  return { ...list, items: sorted, grouped: groupShoppingItems(sorted) };
}

/** B09: haftanın listesine elle kalem ekler; yanıt önbelleğe yazılır (liste yeniden kurulmaz). */
export function useAddShoppingItem(weekDate: string) {
  const qc = useQueryClient();
  const key = queryKeys.shopping.week(weekDate);
  return useMutation({
    mutationFn: (input: Omit<ShoppingManualItemInput, "weekStart">) =>
      apiFetch<ShoppingListItem>("/api/shopping/items", { method: "POST", json: { weekStart: weekDate, ...input } }),
    onSuccess: (item) => {
      const list = qc.getQueryData<ShoppingList>(key);
      if (list) qc.setQueryData(key, withItems(list, [...list.items, item]));
    },
  });
}

/** B09: elle eklenen kalemi siler. */
export function useDeleteShoppingItem(weekDate: string) {
  const qc = useQueryClient();
  const key = queryKeys.shopping.week(weekDate);
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/shopping/items?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: (_res, id) => {
      const list = qc.getQueryData<ShoppingList>(key);
      if (list) qc.setQueryData(key, withItems(list, list.items.filter((i) => i.id !== id)));
    },
  });
}
