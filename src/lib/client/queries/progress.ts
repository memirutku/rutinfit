"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type { ProgressLogInput, ProgressResponse } from "@/lib/schemas/progress";

export function useProgress() {
  return useQuery({
    queryKey: queryKeys.progress,
    queryFn: () => apiFetch<ProgressResponse>("/api/progress"),
  });
}

export function useSaveProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProgressLogInput) => apiFetch("/api/progress", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.progress }),
  });
}

/** Önbellekteki ilerleme verisinde bugünün kreatin işaretini değiştirir. */
export function withCreatine(data: ProgressResponse, date: string, taken: boolean): ProgressResponse {
  return {
    ...data,
    today: data.today.date === date ? { ...data.today, creatineTaken: taken } : data.today,
    creatineCompliance: data.creatineCompliance.map((c) => (c.date === date ? { ...c, taken } : c)),
  };
}

/**
 * Kreatin işareti: iyimser güncelleme. Düğme anında değişir; sunucu hata verirse
 * önceki duruma döner ve hata çağırana iletilir.
 */
export function useToggleCreatine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, taken }: { date: string; taken: boolean }) =>
      apiFetch("/api/progress", { method: "POST", json: { date, creatineTaken: taken, creatineDoseGrams: 5.0 } }),
    onMutate: async ({ date, taken }) => {
      await qc.cancelQueries({ queryKey: queryKeys.progress });
      const previous = qc.getQueryData<ProgressResponse>(queryKeys.progress);
      if (previous) qc.setQueryData(queryKeys.progress, withCreatine(previous, date, taken));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKeys.progress, context.previous);
    },
    onSettled: () =>
      Promise.all([qc.invalidateQueries({ queryKey: queryKeys.progress }), qc.invalidateQueries({ queryKey: queryKeys.supplements })]),
  });
}
