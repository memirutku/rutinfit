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
  /** B36: dışa aktarmalarda uygulama klasörüne kopya (varsayılan açık). */
  exportCopies: boolean;
  suggestedFolder: string;
}

/** B34: her ayar kendi alanıyla kaydedilir; gönderilmeyen alanlar sunucuda aynı kalır. */
export interface AutoBackupInput {
  enabled?: boolean;
  folderPath?: string | null;
  frequency?: "daily" | "weekly";
  keepCount?: number;
  exportCopies?: boolean;
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
