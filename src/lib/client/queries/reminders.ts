"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type { Reminder, ReminderInput } from "@/lib/schemas/reminder";

/** F83: hatırlatmalar. */
export function useReminders() {
  return useQuery({
    queryKey: queryKeys.reminders,
    queryFn: () => apiFetch<{ reminders: Reminder[] }>("/api/reminders"),
    select: (d) => d.reminders,
  });
}

export function useSaveReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<ReminderInput> }) =>
      id ? apiFetch(`/api/reminders?id=${id}`, { method: "PATCH", json: input }) : apiFetch("/api/reminders", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reminders }),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/reminders?id=${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reminders }),
  });
}
