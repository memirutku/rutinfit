"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type { DrinkInput, DrinksDay } from "@/lib/schemas/drinks";

/** F13: günün içecekleri ve özeti. */
export function useDrinks(date: string) {
  return useQuery({
    queryKey: queryKeys.drinks.byDate(date),
    queryFn: () => apiFetch<DrinksDay>(`/api/drinks?date=${encodeURIComponent(date)}`),
  });
}

/** Kalorili içecek besin günlüğüne de yazıldığı için günlük özetler de tazelenir. */
function useInvalidateDrinks() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.drinks.all }),
      qc.invalidateQueries({ queryKey: queryKeys.foodLogs.all }),
    ]);
}

export function useAddDrink() {
  const invalidate = useInvalidateDrinks();
  return useMutation({
    mutationFn: (input: DrinkInput) => apiFetch<{ id: string }>("/api/drinks", { method: "POST", json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteDrink() {
  const invalidate = useInvalidateDrinks();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/drinks?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
