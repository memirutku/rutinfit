"use client";

import { useState } from "react";
import { Copy, FolderOpen } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { copyText } from "@/lib/client/clipboard";
import { useRevealPath } from "@/lib/client/queries/local-files";
import type { RevealRequest } from "@/lib/schemas/local-files";

const BUTTON =
  "inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

interface PathActionsProps {
  /** Gösterilecek dosya: tam yol ya da İndirilenler'deki dosya adı. */
  target: RevealRequest;
  /** "Finder'da göster" düğmesinin erişilebilir adı (ör. "İndirilen dosyayı Finder'da göster"). */
  revealLabel: string;
  /** Verilirse "Yolu kopyala" düğmesi çıkar. */
  copy?: { text: string; label: string };
}

/**
 * B36: ham yol yerine "Finder'da göster" ve "Yolu kopyala". Sonuç ve hata düğmelerin yanında görünür.
 */
export function PathActions({ target, revealLabel, copy }: PathActionsProps) {
  const reveal = useRevealPath();
  const [copied, setCopied] = useState<boolean | null>(null);

  async function onCopy(text: string) {
    setCopied(await copyText(text));
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      <button type="button" aria-label={revealLabel} disabled={reveal.isPending} onClick={() => reveal.mutate(target)} className={BUTTON}>
        <FolderOpen className="w-3.5 h-3.5" aria-hidden />
        Finder'da göster
      </button>
      {copy && (
        <button type="button" aria-label={copy.label} onClick={() => onCopy(copy.text)} className={BUTTON}>
          <Copy className="w-3.5 h-3.5" aria-hidden />
          Yolu kopyala
        </button>
      )}
      {copied === true && (
        <span role="status" className="text-[11px] font-semibold text-emerald-700">
          Yol kopyalandı
        </span>
      )}
      {copied === false && (
        <span role="alert" className="text-[11px] font-semibold text-rose-700">
          Kopyalanamadı; yolu seçip elle kopyala.
        </span>
      )}
      {reveal.isError && (
        <span role="alert" className="text-[11px] font-semibold text-rose-700">
          {errorMessage(reveal.error, "Dosya gösterilemedi.")}
        </span>
      )}
    </span>
  );
}
