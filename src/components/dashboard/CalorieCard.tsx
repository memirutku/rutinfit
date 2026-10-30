"use client";

import { Flame } from "lucide-react";
import type { DailySummary, FoodLogsResponse } from "@/lib/schemas/food";

export type DailyTargets = FoodLogsResponse["targets"];

interface CalorieCardProps {
  summary?: DailySummary;
  targets: DailyTargets;
  /** F56: sayıları gizleme modu. */
  hideNumbers?: boolean;
  /** B02: profil kurulmadıysa hedef tahminidir. */
  estimated?: boolean;
}

/** F56: sayı göstermeden günün ilerlemesi. */
export function verbalCalorieProgress(summary?: DailySummary): string {
  const pct = summary?.progressPercent?.calories || 0;
  if (summary?.ceilingAlert?.isExceeded) return "Tavanın üzerindesin";
  if (pct >= 100) return "Hedefe ulaştın";
  if (pct >= 60) return "Hedefe yaklaşıyorsun";
  return "Güne başladın";
}

/** Kalori Özeti Kartı */
export function CalorieCard({ summary, targets, hideNumbers = false, estimated = false }: CalorieCardProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Bugünkü Kalori
          {estimated && (
            <span className="ml-2 align-middle normal-case tracking-normal text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Tahmini hedef
            </span>
          )}
        </span>
        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
          <Flame className="w-4 h-4" />
        </div>
      </div>

      {hideNumbers ? (
        <div className="my-4">
          <p className="text-2xl font-extrabold text-slate-900">{verbalCalorieProgress(summary)}</p>
          <p className="text-sm text-slate-500 mt-1">Sayılar gizli. Ayarlar sayfasından açabilirsin.</p>
        </div>
      ) : (
      <div className="my-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold text-slate-900">{summary?.consumedCalories || 0}</span>
          <span className="text-slate-400 font-medium text-lg">/ {targets.calorieTarget} kcal</span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Kalan:{" "}
          <span className="font-semibold text-slate-800">{summary?.remainingCalories ?? targets.calorieTarget} kcal</span>{" "}
          (Üst sınır: {targets.calorieCeiling} kcal)
        </p>
      </div>
      )}

      <div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              summary?.ceilingAlert?.isExceeded ? "bg-amber-500" : "bg-brand-600"
            }`}
            style={{ width: `${Math.min(100, summary?.progressPercent?.calories || 0)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1.5 font-medium">
          <span>{hideNumbers ? "Başlangıç" : "%0"}</span>
          <span>{hideNumbers ? "Hedef" : "Hedef: %100"}</span>
          <span>Tavan</span>
        </div>
      </div>
    </div>
  );
}
