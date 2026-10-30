"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type { FastingSettings, FastingTimerStatus, RamadanStatus } from "@/lib/services/fasting";

/** F14 + F76: dakikada bir yenilenir (geri sayım). */
export function useFasting() {
  return useQuery({
    queryKey: queryKeys.fasting,
    queryFn: () => apiFetch<{ ramadan: RamadanStatus | null; timer: FastingTimerStatus }>("/api/fasting"),
    refetchInterval: 60_000,
  });
}

export function useFastingAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "start" | "stop") => apiFetch(`/api/fasting/${action}`, { method: "POST", json: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fasting }),
  });
}

export function useSaveFastingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FastingSettings) => apiFetch("/api/fasting/settings", { method: "PUT", json: input }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: queryKeys.fasting }), qc.invalidateQueries({ queryKey: queryKeys.profile })]),
  });
}
