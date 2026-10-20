"use client";

import { Dumbbell } from "lucide-react";
import type { WorkoutDraft } from "./session-form";

interface DraftResumeBannerProps {
  draft: WorkoutDraft;
  onResume: () => void;
  onDiscard: () => void;
}

/** Yarım kalan antrenman bulunduğunda "kaldığın yerden devam et" bildirimi. */
export function DraftResumeBanner({ draft, onResume, onDiscard }: DraftResumeBannerProps) {
  const sets = draft.sessionForm?.setLogs ?? [];
  return (
    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
          <Dumbbell className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-950">
            Yarım Kalan Antrenmanınız Bulundu: {draft.sessionForm?.name}
          </h4>
          <p className="text-xs text-amber-700">
            {sets.filter((s) => s.completed).length} / {sets.length} set tamamlandı.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onResume}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
        >
          Kaldığın Yerden Devam Et
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="px-3 py-2 rounded-xl text-slate-500 hover:text-slate-700 text-xs font-semibold"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
