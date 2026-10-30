"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";

export interface AutoBackupView {
  enabled: boolean;
  folderPath: string | null;
  frequency: "daily" | "weekly";
  keepCount: number;
  lastRunAt: string | null;
  lastStatus: "ok" | "error" | null;
  lastMessage: string | null;
  lastFile: string | null;
  suggestedFolder: string;
}

export interface AutoBackupInput {
  enabled: boolean;
  folderPath: string | null;
  frequency: "daily" | "weekly";
  keepCount: number;
}

/** F61: otomatik yedek ayarları. */
export function useAutoBackup() {
  return useQuery({ queryKey: queryKeys.autoBackup, queryFn: () => apiFetch<AutoBackupView>("/api/backup/auto") });
}

export function useSaveAutoBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AutoBackupInput) => apiFetch<AutoBackupView>("/api/backup/auto", { method: "PUT", json: input }),
    onSuccess: (data) => qc.setQueryData(queryKeys.autoBackup, data),
  });
}

export function useRunAutoBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean; message: string; file?: string }>("/api/backup/auto", { method: "POST" }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.autoBackup }),
  });
}
