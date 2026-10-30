"use client";

import { Plus } from "lucide-react";
import type { ConversationSummary } from "@/lib/schemas/chat";

interface CoachHeaderProps {
  conversations: ConversationSummary[];
  conversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

/** Sayfa başlığı, geçmiş sohbet seçici ve "Yeni Sohbet" düğmesi. */
export function CoachHeader({ conversations, conversationId, onSelect, onNew }: CoachHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            AI Sağlık & Beslenme Koçu 🤖
          </h2>
          <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
            Yerel-First & Güvenli Eylem
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          Ollama / LM Studio ile yerel çalışır; çok formatlı dosya yükleme ve 2 aşamalı onaylı eylem motoru içerir.
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
