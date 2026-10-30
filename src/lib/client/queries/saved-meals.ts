"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type { ApplySavedMealInput, CopyFoodLogsInput, SaveMealInput, SavedMealSummary } from "@/lib/schemas/saved-meals";

/** F01: kayıtlı öğünler. */
export function useSavedMeals(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.savedMeals,
    queryFn: () => apiFetch<SavedMealSummary[]>("/api/saved-meals"),
    enabled: options.enabled ?? true,
  });
}

export function useSaveMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveMealInput) => apiFetch<{ id: string }>("/api/saved-meals", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.savedMeals }),
  });
}

export function useDeleteSavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/saved-meals?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.savedMeals }),
  });
}

export function useApplySavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplySavedMealInput) =>
      apiFetch<{ created: number }>("/api/saved-meals/apply", { method: "POST", json: input }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.foodLogs.all }),
        qc.invalidateQueries({ queryKey: queryKeys.savedMeals }),
      ]),
  });
}

export function useCopyFoodLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CopyFoodLogsInput) => apiFetch<{ copied: number }>("/api/food-logs/copy", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.foodLogs.all }),
  });
}
