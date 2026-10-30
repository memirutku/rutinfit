"use client";

import { Target } from "lucide-react";
import { formatDateTr, formatNumberTr } from "@/lib/format";
import type { WeightGoalProgress } from "@/lib/weight-goal";

interface WeightGoalCardProps {
  progress: WeightGoalProgress;
  goalType: "lose" | "gain";
  /** F56: sayıları gizleme modunda yalnız sözel ilerleme. */
  hideNumbers?: boolean;
  /** Kilo kaydından hemen sonra gösterilen kısa mesaj. */
  note?: string | null;
}

const kg = (n: number) => `${formatNumberTr(n)} kg`;

function verbal(p: WeightGoalProgress): string {
  if (p.reached) return "Hedefine ulaştın";
  if (p.percent >= 75) return "Hedefe çok yakınsın";
  if (p.percent >= 25) return "Yolun bir kısmını geçtin";
  if (p.changedKg > 0) return "İlk adımları attın";
  return "Yolun başındasın";
}

/** B07: Kilo hedefine ilerleme kartı (7 günlük ortalamaya göre). */
export function WeightGoalCard({ progress: p, goalType, hideNumbers = false, note }: WeightGoalCardProps) {
  const verb = goalType === "lose" ? "verdin" : "aldın";
  return (
    <section aria-label="Kilo hedefim" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Kilo Hedefim</span>
        <Target className="w-4 h-4 text-brand-600" />
      </div>

      {hideNumbers ? (
        <p className="text-lg font-bold text-slate-900">{verbal(p)}</p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-2xl font-extrabold text-slate-900">{kg(p.currentKg)}</p>
          <p className="text-sm text-slate-500">
            Hedef {kg(p.targetKg)} · Başlangıç {kg(p.startKg)}
          </p>
        </div>
      )}

      <div
        className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-label="Hedefe ilerleme"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.percent}
      >
        <div className="h-full bg-brand-500" style={{ width: `${p.percent}%` }} />
      </div>

      {!hideNumbers && (
        <p className="text-xs text-slate-600">
          {p.reached ? (
            <span className="font-bold text-emerald-700">Hedefine ulaştın.</span>
          ) : (
            <>
              {p.changedKg >= 0 ? (
                <span className="font-semibold">
                  {kg(p.changedKg)} {verb}
                </span>
              ) : (
                <span className="font-semibold text-amber-700">Hedefin ters yönünde {kg(-p.changedKg)}</span>
              )}
              {" · "}
              <span className="font-semibold">{kg(p.remainingKg)} kaldı</span>
              {p.etaDate && <> · Tahmini varış: {formatDateTr(p.etaDate)}</>}
            </>
          )}
        </p>
      )}
      <p className="text-[11px] text-slate-400">Güncel kilo 7 günlük ortalamadır; tek günlük tartı dalgalanmasını yansıtmaz.</p>
      {note && (
        <p role="status" className="text-xs font-semibold text-emerald-700">
          {note}
        </p>
      )}
    </section>
  );
}
