"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type { LibraryExercise } from "@/lib/exercise-library";

export interface ExerciseFilters {
  search: string;
  muscle: string;
  equipment: string;
}

/** F25: kütüphane listesi (özel egzersizler dahil). */
export function useExercises(filters: ExerciseFilters) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
  return useQuery({
    queryKey: queryKeys.exercises.list(params.toString()),
    queryFn: () => apiFetch<LibraryExercise[]>(`/api/exercises${params.size ? `?${params}` : ""}`),
  });
}

export function useExerciseAlternatives(name: string | null) {
  return useQuery({
    queryKey: queryKeys.exercises.alternatives(name ?? ""),
    queryFn: () => apiFetch<{ exercise: LibraryExercise; alternatives: LibraryExercise[] }>(`/api/exercises?alternativesFor=${encodeURIComponent(name!)}`),
    enabled: !!name,
  });
}

export interface CustomExerciseInput {
  name: string;
  primary: string;
  equipment: string;
  cues: string[];
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomExerciseInput) => apiFetch<LibraryExercise>("/api/exercises", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.exercises.all }),
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/exercises?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.exercises.all }),
  });
}
