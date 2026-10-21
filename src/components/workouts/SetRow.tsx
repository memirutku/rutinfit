"use client";

import { useId } from "react";
import { CheckCircle2 } from "lucide-react";
import type { SessionSet } from "./session-form";

interface SetRowProps {
  set: SessionSet;
  onChange: (patch: Partial<SessionSet>) => void;
  onToggle: () => void;
}

/** Tek set satırı: ağırlık, tekrar ve tamamlandı işareti. Her satırın alan kimlikleri benzersizdir. */
export function SetRow({ set, onChange, onToggle }: SetRowProps) {
  const weightId = useId();
  const repsId = useId();

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border gap-3 transition-colors ${
        set.completed ? "bg-emerald-50/70 border-emerald-300" : "bg-slate-50 border-slate-200/80"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
            set.completed ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
          }`}
        >
          {set.setNumber}
        </span>
        <div>
          <p className="font-bold text-slate-900 text-sm">{set.exerciseName}</p>
          <p className="text-xs text-slate-400">
            Hedef tekrar: {set.targetRepMin} - {set.targetRepMax}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-1.5">
          <label htmlFor={weightId} className="text-xs font-semibold text-slate-600">
            Ağırlık:
          </label>
          <input
            id={weightId}
            type="number"
            step="0.5"
            value={set.weightKg}
            onChange={(e) => onChange({ weightKg: parseFloat(e.target.value) || 0 })}
            className="w-20 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 text-center"
          />
          <span className="text-xs text-slate-400">kg</span>
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor={repsId} className="text-xs font-semibold text-slate-600">
            Tekrar:
          </label>
          <input
            id={repsId}
            type="number"
            value={set.reps}
            onChange={(e) => onChange({ reps: parseInt(e.target.value) || 0 })}
            className="w-16 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 text-center"
          />
        </div>

        <button
          type="button"
          onClick={onToggle}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 ${
            set.completed
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              : "bg-white hover:bg-slate-100 border border-slate-300 text-slate-700"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{set.completed ? "Tamamlandı" : "Tamamla"}</span>
        </button>
      </div>
    </div>
  );
}
