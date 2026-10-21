"use client";

export const QUICK_PROMPTS = [
  "Bugünkü protein hedefimi tamamlamak için akşam ne yiyebilirim?",
  "Evde yumurta, yoğurt, tavuk ve bulgur var; 2.080 kcal hedefine uyan bir yemek öner.",
  "Bugün işten çok yorgun geldim, antrenmanımı 25 dakikalık daha hafif bir sürüme çevir.",
  "OpenGym antrenman durumumu ve bu haftaki ilerlememi özetle.",
] as const;

interface QuickPromptsProps {
  disabled: boolean;
  onSend: (prompt: string) => void;
}

/** Tek tıkla gönderilen hazır sorular. */
export function QuickPrompts({ disabled, onSend }: QuickPromptsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {QUICK_PROMPTS.map((p) => (
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
