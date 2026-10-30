"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type { FinishWorkoutResponse, WorkoutSessionInput, WorkoutsResponse } from "@/lib/schemas/workout";

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

export function useFinishWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutSessionInput) =>
      apiFetch<FinishWorkoutResponse>("/api/workouts", { method: "POST", json: input }),
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
