"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import type { ChooseFolderResult, RevealRequest, RevealResult } from "@/lib/schemas/local-files";

/** B36: dosyayı (ya da İndirilenler'deki indirmeyi) Finder'da seçili gösterir. */
export function useRevealPath() {
  return useMutation({
    mutationFn: (input: RevealRequest) => apiFetch<RevealResult>("/api/system/reveal", { method: "POST", json: input }),
  });
}

/** B36: macOS klasör seçme penceresi; vazgeçilirse `path: null`. */
export function useChooseFolder() {
  return useMutation({
    mutationFn: () => apiFetch<ChooseFolderResult>("/api/system/choose-folder", { method: "POST", json: { purpose: "auto-backup" } }),
  });
}
