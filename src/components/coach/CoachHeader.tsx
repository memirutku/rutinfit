"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import type { ConversationSummary } from "@/lib/schemas/chat";

interface CoachHeaderProps {
  conversations: ConversationSummary[];
  conversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** B28: model sunucusunun gerçek durumunu gösteren rozet. */
  statusBadge?: ReactNode;
}

/** Sayfa başlığı, geçmiş sohbet seçici ve "Yeni Sohbet" düğmesi. */
export function CoachHeader({ conversations, conversationId, onSelect, onNew, statusBadge }: CoachHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            AI Sağlık & Beslenme Koçu 🤖
          </h2>
          {statusBadge}
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          Ollama / LM Studio ile bu bilgisayarda çalışır. Dosya yükleyebilirsin; koçun önerdiği değişiklikler senin onayınla uygulanır.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {conversations.length > 0 && (
          <select
            aria-label="Geçmiş sohbetler"
            value={conversationId || ""}
            onChange={(e) => {
              if (e.target.value) onSelect(e.target.value);
            }}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 max-w-[200px] truncate"
          >
            <option value="">Geçmiş Sohbetler ({conversations.length})</option>
            {conversations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={onNew}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Yeni Sohbet</span>
        </button>
      </div>
    </div>
  );
}
