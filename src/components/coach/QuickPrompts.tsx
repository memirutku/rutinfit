"use client";

import { formatNumberTr } from "@/lib/format";
import type { CoachTargets } from "./types";

/**
 * Tek tıkla gönderilen hazır sorular. B03: kalori sayısı profildeki hedeften gelir; "sayıları gizle"
 * açıksa ya da profil yoksa soru sayısız sorulur (model hedefi zaten sistem isteminden bilir).
 */
export function quickPrompts(targets: CoachTargets | null, hideNumbers: boolean): string[] {
  const goal = targets && !hideNumbers ? `günlük ${formatNumberTr(targets.calorieTarget)} kcal hedefime` : "kalori hedefime";
  return [
    "Bugünkü protein hedefimi tamamlamak için akşam ne yiyebilirim?",
    `Evde yumurta, yoğurt, tavuk ve bulgur var; ${goal} uyan bir yemek öner.`,
    "Bugün çok yorgunum, antrenmanımı 25 dakikalık daha hafif bir sürüme çevir.",
    "OpenGym antrenman durumumu ve bu haftaki ilerlememi özetle.",
  ];
}

interface QuickPromptsProps {
  prompts: string[];
  disabled: boolean;
  onSend: (prompt: string) => void;
}

export function QuickPrompts({ prompts, disabled, onSend }: QuickPromptsProps) {
  return (
    // B27: şerit kendi içinde yatay kayar; içerik genişliği sayfayı genişletmez (inline-size containment).
    <div role="group" aria-label="Hazır sorular" className="flex gap-2 overflow-x-auto pb-1 max-w-full [contain:inline-size]">
      {prompts.map((p) => (
        <button
          key={p}
          disabled={disabled}
          onClick={() => onSend(p)}
          className="px-3 py-1.5 bg-white border border-slate-200 hover:border-brand-500 hover:text-brand-600 rounded-xl text-xs font-semibold text-slate-600 whitespace-nowrap transition-colors shadow-2xs disabled:opacity-50"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
