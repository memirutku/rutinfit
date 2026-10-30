"use client";

import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

interface DashboardHeaderProps {
  /** B02: yalnız kullanıcı gün düzenini (ofis/okul) girdiyse gösterilir. */
  homeTime?: string;
  onQuickAdd: () => void;
}

/** Üst Karşılama ve Hızlı Başlık */
export function DashboardHeader({ homeTime, onQuickAdd }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Merhaba, Hoş Geldin 👋</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Bugün:{" "}
          {new Date().toLocaleDateString("tr-TR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          {homeTime && <> · Eve tahmini varış: {homeTime}</>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/coach"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-50 text-brand-700 text-sm font-semibold hover:bg-brand-100 transition-colors border border-brand-200"
        >
          <Sparkles className="w-4 h-4 text-brand-600" />
          <span>AI Koçuna Danış</span>
        </Link>
        <button
          onClick={onQuickAdd}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Hızlı Öğün Ekle</span>
        </button>
      </div>
    </div>
  );
}
