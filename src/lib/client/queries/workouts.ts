"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type {
  FinishWorkoutResponse,
  LastSetsResponse,
  TemplateInput,
  WorkoutSession,
  WorkoutSessionInput,
  WorkoutTemplate,
  WorkoutsResponse,
} from "@/lib/schemas/workout";
import type { StrengthDetail, StrengthList, WeeklyVolumeResponse } from "@/lib/schemas/progress";

/** Şablonlar + son 20 seans (tarih verilirse yalnız o günün seansları). */
export function useWorkouts(date?: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.workouts.list(date),
    queryFn: async () => {
      const data = await apiFetch<WorkoutsResponse>(
        date ? `/api/workouts?date=${encodeURIComponent(date)}` : "/api/workouts"
      );
      return { templates: data.templates ?? [], sessions: data.sessions ?? [] };
    },
    enabled: options.enabled ?? true,
  });
}

/**
 * B17: verilen egzersizlerin son tamamlanmış seanstaki setleri (seans formunu doldurmak için).
 * Anahtar "workouts" önekiyle başlar: seans kaydedilince birlikte tazelenir.
 */
export function useLastSets(exerciseNames: string[]) {
  const names = [...new Set(exerciseNames)].sort();
  return useQuery({
    queryKey: ["workouts", "last-sets", names] as const,
    queryFn: () => {
      const qs = new URLSearchParams(names.map((n) => ["exercise", n]));
      return apiFetch<LastSetsResponse>(`/api/workouts/last-sets?${qs.toString()}`);
    },
    enabled: names.length > 0,
  });
}

export function useFinishWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutSessionInput) =>
      apiFetch<FinishWorkoutResponse>("/api/workouts", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });
}

/** B19: seans geçmişi (en yeni önce; `limit` kadar). */
export function useWorkoutHistory(limit: number) {
  return useQuery({
    queryKey: ["workouts", "history", limit] as const,
    queryFn: async () => (await apiFetch<WorkoutsResponse>(`/api/workouts?limit=${limit}`)).sessions ?? [],
  });
}

/** B19: geçmiş seansı düzenler (setler gönderilenle değiştirilir). */
export function useUpdateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WorkoutSessionInput }) =>
      apiFetch<WorkoutSession>(`/api/workouts?id=${encodeURIComponent(id)}`, { method: "PUT", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });
}

/** B19: seansı siler. */
export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/workouts?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });
}

/** Hevy/Strong CSV geçmişi aktarımı. */
export function useImportWorkoutsCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csvText: string) =>
      apiFetch<{ message: string }>("/api/workouts/import", { method: "POST", json: { csvText } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });
}

/** F23: egzersiz listesi ya da seçilen egzersizin geçmişi ve rekorları. */
export function useStrengthExercises() {
  return useQuery({
    queryKey: queryKeys.workouts.strengthList,
    queryFn: () => apiFetch<StrengthList>("/api/progress/strength"),
  });
}

export function useStrengthDetail(exercise: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workouts.strengthDetail(exercise ?? ""),
    queryFn: () => apiFetch<StrengthDetail>(`/api/progress/strength?exercise=${encodeURIComponent(exercise!)}`),
    enabled: !!exercise,
  });
}

/** F24: kas grubu başına haftalık set. */
export function useWeeklyVolume(weeks = 4) {
  return useQuery({
    queryKey: queryKeys.workouts.volume(weeks),
    queryFn: () => apiFetch<WeeklyVolumeResponse>(`/api/progress/volume?weeks=${weeks}`),
  });
}

/** F17: şablon oluşturma / güncelleme (id varsa günceller). */
export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TemplateInput }) =>
      apiFetch<WorkoutTemplate>(id ? `/api/workouts/templates?id=${encodeURIComponent(id)}` : "/api/workouts/templates", {
        method: id ? "PUT" : "POST",
        json: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/workouts/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });
}

export interface ProgramSummary {
  id: string;
  name: string;
  description: string;
  place: string;
  daysPerWeek: number;
  days: Array<{ dayOfWeek: number; name: string; exercises: number }>;
}

/** F18: hazır programlar. */
export function usePrograms(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["programs"] as const,
    queryFn: () => apiFetch<ProgramSummary[]>("/api/workouts/programs"),
    enabled: options.enabled ?? true,
    staleTime: Infinity,
  });
}

export function useApplyProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { programId: string; mode: "replace" | "add" }) =>
      apiFetch<{ created: number }>("/api/workouts/programs", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });
}
