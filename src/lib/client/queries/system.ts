"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type { Profile, ProfileInput } from "@/lib/schemas/profile";
import type {
  AISettingsView,
  ExposureResult,
  UpdateAISettingsInput,
  BackupImportResult,
  Diagnostics,
  OpenGymStatus,
  OpenGymSyncResult,
  TestConnectionInput,
  TestConnectionResult,
} from "@/lib/schemas/system";

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiFetch<Profile>("/api/profile"),
  });
}

/** Profil ve hedefler. Hedefler günlük özetin parçası olduğu için öğün özetleri de tazelenir. */
export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => apiFetch<Profile>("/api/profile", { method: "PUT", json: input }),
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.profile, profile);
      return qc.invalidateQueries({ queryKey: queryKeys.foodLogs.all });
    },
  });
}

/** B38: tanılama bölümü `refetchInterval` ile kendini yeniler. */
export function useDiagnostics(options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.diagnostics,
    queryFn: () => apiFetch<Diagnostics>("/api/diagnostics"),
    refetchInterval: options.refetchInterval,
  });
}

export function useTestAIConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TestConnectionInput) =>
      apiFetch<TestConnectionResult>("/api/ai/test-connection", { method: "POST", json: input }),
    // Başarılı test ayarları kaydeder: uç nokta göstergesi ve ağ kontrolü tazelenir.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.aiSettings }),
        qc.invalidateQueries({ queryKey: queryKeys.aiExposure }),
      ]),
  });
}

/** F58/F67: kayıtlı yapay zekâ ayarları (koç durumu, üslup, uç nokta türü). */
export function useAISettings() {
  return useQuery({
    queryKey: queryKeys.aiSettings,
    queryFn: () => apiFetch<AISettingsView>("/api/ai/settings"),
  });
}

/** F67: yerel model sunucusu yerel ağa açık mı? */
export function useAIExposure() {
  return useQuery({
    queryKey: queryKeys.aiExposure,
    queryFn: () => apiFetch<ExposureResult>("/api/ai/exposure"),
  });
}

export function useSaveAISettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAISettingsInput) => apiFetch<AISettingsView>("/api/ai/settings", { method: "PUT", json: input }),
    onSuccess: (settings) => qc.setQueryData(queryKeys.aiSettings, settings),
  });
}

/** openGym durumu. Servis kapalıyken sunucu 500 + { isOnline: false } döner; bu bir sonuçtur, hata değil. */
export async function fetchOpenGymStatus(): Promise<OpenGymStatus> {
  try {
    return await apiFetch<OpenGymStatus>("/api/opengym/status");
  } catch (e) {
    return { isOnline: false, error: errorMessage(e, "openGym servisi ile bağlantı kurulamadı.") };
  }
}

export function useOpenGymStatus(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.openGymStatus,
    queryFn: fetchOpenGymStatus,
    enabled: options.enabled ?? true,
  });
}

export function useOpenGymSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<OpenGymSyncResult>("/api/opengym/sync", { method: "POST" }),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.openGymStatus }),
        qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
        qc.invalidateQueries({ queryKey: queryKeys.progress }),
      ]),
  });
}

/** Yedek geri yükleme: tüm tablolar değişebilir, bu yüzden bütün önbellek tazelenir. */
export function useImportBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (backup: unknown) =>
      apiFetch<BackupImportResult>("/api/backup/import", { method: "POST", json: backup }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
