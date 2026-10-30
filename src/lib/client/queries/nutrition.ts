"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type {
  FoodItem,
  FoodItemInput,
  FoodLog,
  FoodLogCreateInput,
  FoodLogPatchInput,
  FoodLogsResponse,
  PackagedProductSaveInput,
  ProductSearchResponse,
  Recipe,
  RecipeInput,
} from "@/lib/schemas/food";
import type { MealPlan } from "@/lib/schemas/meal-plan";
import type { QuickFoodId } from "@/lib/quick-foods";
import type { MealType } from "@/lib/schemas/enums";
import type { Adherence, AdherenceSummary } from "@/lib/adherence";

/* ----------------------------- Sorgular ----------------------------- */

export function useFoodLogs(date: string) {
  return useQuery({
    queryKey: queryKeys.foodLogs.byDate(date),
    queryFn: () => apiFetch<FoodLogsResponse>(`/api/food-logs?date=${encodeURIComponent(date)}`),
  });
}

export function useFoods(limit: number, options: { enabled?: boolean; sort?: "usage" } = {}) {
  return useQuery({
    queryKey: queryKeys.foods.list(limit, options.sort),
    // Hata gövdesi (ör. { error }) diziye yazılırsa .filter çöküyordu; yalnız dizi kabul edilir.
    queryFn: async () => {
      const data = await apiFetch<FoodItem[]>(`/api/foods?limit=${limit}${options.sort ? `&sort=${options.sort}` : ""}`);
      return Array.isArray(data) ? data : [];
    },
    enabled: options.enabled ?? true,
  });
}

export function useRecipes(enabled = true) {
  return useQuery({
    queryKey: queryKeys.recipes,
    queryFn: async () => {
      const data = await apiFetch<Recipe[]>("/api/recipes");
      return Array.isArray(data) ? data : [];
    },
    enabled,
  });
}

export function useMealPlans(date: string) {
  return useQuery({
    queryKey: queryKeys.mealPlans.byDate(date),
    queryFn: async () => {
      const data = await apiFetch<MealPlan[]>(`/api/meal-plans?date=${encodeURIComponent(date)}`);
      return Array.isArray(data) ? data : [];
    },
  });
}

/* ---------------------------- Mutasyonlar --------------------------- */

/** Öğün kaydı ekler; o günün özetini ve son kullanılanları tazeler. */
export function useCreateFoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodLogCreateInput) => apiFetch<FoodLog>("/api/food-logs", { method: "POST", json: input }),
    onSuccess: (_created, input) => qc.invalidateQueries({ queryKey: queryKeys.foodLogs.byDate(input.date) }),
  });
}

/** B13: kaydın öğününü değiştirir. */
export function useUpdateFoodLogMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: FoodLogPatchInput & { id: string }) =>
      apiFetch<FoodLog>(`/api/food-logs?id=${encodeURIComponent(id)}`, { method: "PATCH", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.foodLogs.all }),
  });
}

export function useDeleteFoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/food-logs?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.foodLogs.all }),
  });
}

export function useCreateFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodItemInput) => apiFetch<FoodItem>("/api/foods", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.foods.all }),
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeInput) => apiFetch<Recipe>("/api/recipes", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recipes }),
  });
}

/** Barkod (6–14 hane) ya da ürün adıyla Open Food Facts / yerel katalog araması. */
export function searchPackagedProducts(query: string): Promise<ProductSearchResponse> {
  const q = query.trim();
  const param = /^[0-9]{6,14}$/.test(q) ? "barcode" : "query";
  return apiFetch<ProductSearchResponse>(`/api/foods/barcode?${param}=${encodeURIComponent(q)}`);
}

export function useSavePackagedProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PackagedProductSaveInput) =>
      apiFetch<{ foodItem: FoodItem; message: string }>("/api/foods/barcode", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.foods.all }),
  });
}

/** F79: simit, ekmek dilimi gibi kalemleri tek tıkla ekler. */
export function useQuickAddFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { item: QuickFoodId; count: number; date: string; mealType?: MealType }) =>
      apiFetch<FoodLog>("/api/quick-add", { method: "POST", json: input }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.foodLogs.all }),
        qc.invalidateQueries({ queryKey: queryKeys.foods.all }),
      ]),
  });
}

/** F78: tarih aralığındaki plana uyum özeti. */
export function useAdherenceSummary(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.mealPlans.adherence(from, to),
    queryFn: () => apiFetch<AdherenceSummary>(`/api/meal-plans/adherence?from=${from}&to=${to}`),
  });
}

/** F78: planlı öğünü işaretler; planlar ve uyum özeti tazelenir (aynı önek). */
export function useSetAdherence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { plannedMealId: string; adherence: Adherence | null }) =>
      apiFetch("/api/meal-plans/adherence", { method: "PATCH", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.mealPlans.all }),
  });
}
