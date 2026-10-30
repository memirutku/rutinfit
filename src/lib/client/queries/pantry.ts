"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { mutationKeys, queryKeys } from "./keys";
import type { PantryItemInput, PantryItemResult, PantryResponse } from "@/lib/schemas/pantry";

export function usePantry() {
  return useQuery({
    queryKey: queryKeys.pantry,
    queryFn: async () => (await apiFetch<PantryResponse>("/api/pantry")).items ?? [],
  });
}

export function useSavePantryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PantryItemInput) => apiFetch<PantryItemResult>("/api/pantry", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pantry }),
  });
}

export function useDeletePantryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/pantry?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: (_res, id) => {
      qc.setQueryData<PantryResponse["items"]>(queryKeys.pantry, (prev) => prev?.filter((i) => i.id !== id));
    },
  });
}

/**
 * Kiler ± düğmeleri: iyimser güncelleme. Miktar anında değişir; sunucuda atomik artırım
 * yapılır (hızlı art arda tıklamalar birbirini ezmez). Bekleyen son istek bitince liste
 * sunucudan tazelenir; hata olursa önceki miktara dönülür.
 */
export function useAdjustPantry() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.pantryAdjust,
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      apiFetch<PantryItemResult>("/api/pantry", { method: "PATCH", json: { id, delta } }),
    onMutate: async ({ id, delta }) => {
      await qc.cancelQueries({ queryKey: queryKeys.pantry });
      const previous = qc.getQueryData<PantryResponse["items"]>(queryKeys.pantry);
      qc.setQueryData<PantryResponse["items"]>(queryKeys.pantry, (items) =>
        items?.map((i) => (i.id === id ? { ...i, amount: Math.round((i.amount + delta) * 1000) / 1000 } : i))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKeys.pantry, context.previous);
    },
    onSettled: () => {
      // Başka ± isteği sürüyorsa tazeleme beklenir (iyimser değer geri sıçramaz).
      if (qc.isMutating({ mutationKey: mutationKeys.pantryAdjust }) <= 1) {
        return qc.invalidateQueries({ queryKey: queryKeys.pantry });
      }
    },
  });
}
