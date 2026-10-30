"use client";

import { ChevronRight } from "lucide-react";
import type { RhythmAction, RhythmStep } from "./rhythm";

interface RhythmStepCardProps {
  step: RhythmStep;
  onAction: (action: RhythmAction) => void;
}

/** Günün Sıradaki Adımı / Ritim Çizelgesi */
export function RhythmStepCard({ step, onAction }: RhythmStepCardProps) {
  const Icon = step.icon;
  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
              Sıradaki Adım · {step.time}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-medium">
              {step.badge}
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-0.5">{step.title}</h3>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">{step.description}</p>
        </div>
      </div>
      <button
        onClick={() => onAction(step.action)}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition-colors shrink-0 shadow-sm"
      >
        <span>{step.actionText}</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
