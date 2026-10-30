"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";

export interface CardioLogView {
  id: string;
  date: string;
  kind: string;
  durationMin: number;
  distanceKm: number | null;
  avgHr: number | null;
  rpe: number | null;
  kcal: number | null;
  kcalEstimated: boolean;
  notes: string | null;
  pace: string | null;
}

export interface CardioInput {
  date: string;
  kind: string;
  durationMin: number;
  distanceKm?: number | null;
  avgHr?: number | null;
  rpe?: number | null;
  kcal?: number | null;
  notes?: string | null;
}

const KEY = ["cardio"] as const;

/** F27: tarih aralığındaki kardiyo kayıtları ve özeti. */
export function useCardio(from: string, to: string) {
  return useQuery({
    queryKey: [...KEY, from, to],
    queryFn: () =>
      apiFetch<{ logs: CardioLogView[]; summary: { sessions: number; minutes: number; distanceKm: number } }>(`/api/cardio?from=${from}&to=${to}`),
  });
}

export function useAddCardio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CardioInput) => apiFetch<CardioLogView>("/api/cardio", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCardio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/cardio?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
