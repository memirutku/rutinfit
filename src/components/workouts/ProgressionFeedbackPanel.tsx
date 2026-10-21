"use client";

import { Sparkles } from "lucide-react";
import type { ProgressionFeedback } from "@/lib/schemas/workout";

/** Antrenman kaydedildikten sonra egzersiz başına ilerleme önerisi. */
export function ProgressionFeedbackPanel({ feedback }: { feedback: Record<string, ProgressionFeedback> }) {
  return (
    <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-emerald-950 text-base">
          Tebrikler! Seans Tamamlandı & İlerleme Analizi
        </h3>
      </div>
      <div className="space-y-2 mt-3">
        {Object.entries(feedback).map(([exName, fb]) => (
          <div key={exName} className="bg-white/80 p-3 rounded-xl border border-emerald-100 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
              <span>{exName}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${
                  fb.isTargetMetAllSets ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                }`}
              >
                {fb.isTargetMetAllSets ? "Ağırlık Artışı Önerisi" : "Ağırlığı Koru"}
              </span>
            </div>
            <p className="text-slate-600">{fb.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
