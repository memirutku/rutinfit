"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";

/** B01: katalogdaki besin ve tarif sayısı. */
export function useStarterCatalogStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog.starter,
    queryFn: () => apiFetch<{ foods: number; recipes: number }>("/api/catalog/starter"),
    enabled,
  });
}

/** B01: temel besinleri, Türk ev yemeklerini ve hızlı kalemleri kurar; katalog listeleri tazelenir. */
export function useInstallStarterCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ foodsCreated: number; recipesCreated: number }>("/api/catalog/starter", { method: "POST" }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.catalog.all }),
        qc.invalidateQueries({ queryKey: queryKeys.foods.all }),
        qc.invalidateQueries({ queryKey: queryKeys.recipes }),
      ]),
  });
}
