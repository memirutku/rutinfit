"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type {
  AIStatus,
  ActionRequest,
  MealSuggestions,
  ChatRequest,
  ChatResponse,
  ConversationDetail,
  ConversationSummary,
  UploadResponse,
} from "@/lib/schemas/chat";

/**
 * B28: kayıtlı model sunucusu çalışıyor mu? Koç sayfası ve ayarlar açılınca denetlenir;
 * sohbet bağlantı hatası verince yeniden denetlenir.
 */
export function useAIStatus() {
  return useQuery({
    queryKey: queryKeys.aiStatus,
    queryFn: () => apiFetch<AIStatus>("/api/ai/status"),
    staleTime: 0,
  });
}

/** B42: yalnız model kullanılamıyorken istenir (yapay zekâsız öneri). */
export function useMealSuggestions(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.mealSuggestions,
    queryFn: () => apiFetch<MealSuggestions>("/api/ai/meal-suggestions"),
    enabled,
    staleTime: 0,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations.all,
    queryFn: async () =>
      (await apiFetch<{ conversations?: ConversationSummary[] }>("/api/ai/chat")).conversations ?? [],
  });
}

/** Geçmiş bir sohbeti her seferinde sunucudan (taslak durumlarıyla) yükler. */
export function useLoadConversation() {
  const qc = useQueryClient();
  return (id: string) =>
    qc.fetchQuery({
      queryKey: queryKeys.conversations.detail(id),
      queryFn: () => apiFetch<ConversationDetail>(`/api/ai/chat?conversationId=${encodeURIComponent(id)}`),
      staleTime: 0,
    });
}

export function useSendChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChatRequest) => apiFetch<ChatResponse>("/api/ai/chat", { method: "POST", json: input }),
    onSuccess: (data, input) => {
      const work: Promise<void>[] = [];
      // B28: modele ulaşılamadıysa sayfadaki durum satırı ve rozet tazelenir.
      if (data.errorKind) work.push(qc.invalidateQueries({ queryKey: queryKeys.aiStatus }));
      if (data.conversationId && !input.conversationId) {
        work.push(qc.invalidateQueries({ queryKey: queryKeys.conversations.all, exact: true }));
      }
      return Promise.all(work);
    },
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetch<UploadResponse>("/api/files/upload", { method: "POST", body: form });
    },
  });
}

/** İki aşamalı onay: approve / reject / reissue. Onaylanan taslak plana veya antrenmana yazılır. */
export function useDraftAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActionRequest) =>
      apiFetch<{ approvalToken?: string; message?: string }>("/api/ai/actions", { method: "POST", json: input }),
    onSuccess: (_data, input) => {
      if ((input.action ?? "approve") !== "approve") return;
      return Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.mealPlans.all }),
        qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
        qc.invalidateQueries({ queryKey: queryKeys.shopping.all }),
      ]);
    },
  });
}
