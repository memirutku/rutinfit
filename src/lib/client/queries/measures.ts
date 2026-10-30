"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import type { MergedMeasure } from "@/lib/measures";

const KEY = ["measures"] as const;

/** F73: bir besinin ölçüleri (yerleşik + kullanıcının). */
export function useFoodMeasures(foodId: string | null) {
  return useQuery({
    queryKey: [...KEY, foodId],
    queryFn: () => apiFetch<{ food: { id: string; name: string }; measures: MergedMeasure[] }>(`/api/foods/measures?foodId=${encodeURIComponent(foodId!)}`),
    enabled: !!foodId,
  });
}

/** Hızlı ekleme için bütün kullanıcı ölçüleri, besin kimliğine göre. */
export function useAllCustomMeasures(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "all"],
    queryFn: async () => {
      const { custom } = await apiFetch<{ custom: Array<{ id: string; foodItemId: string; name: string; grams: number }> }>("/api/foods/measures?all=1");
      const map: Record<string, Array<{ id: string; name: string; grams: number }>> = {};
      for (const c of custom) (map[c.foodItemId] ??= []).push({ id: c.id, name: c.name, grams: c.grams });
      return map;
    },
    enabled,
  });
}

export function useSaveMeasure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { foodItemId: string; name: string; grams: number }) => apiFetch("/api/foods/measures", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteMeasure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/foods/measures?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
