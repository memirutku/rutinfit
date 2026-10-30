"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DailySummary } from "@/lib/schemas/food";
import type { DailyTargets } from "./CalorieCard";

interface MacroBarProps {
  label: string;
  target: number;
  consumed?: number;
  remaining?: number;
  percent?: number;
  barClass: string;
  hideNumbers?: boolean;
}

function MacroBar({ label, target, consumed, remaining, percent, barClass, hideNumbers }: MacroBarProps) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold text-slate-700">{hideNumbers ? label : `${label} (Hedef: ${target}g)`}</span>
        {!hideNumbers && (
          <span className="font-bold text-slate-900">
            {consumed || 0}g / {target}g{" "}
            <span className="text-xs text-slate-400 font-normal">(Kalan: {remaining ?? target}g)</span>
          </span>
        )}
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`${barClass} h-full rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, percent || 0)}%` }}
        />
      </div>
    </div>
  );
}

interface MacroBalanceCardProps {
  summary?: DailySummary;
  targets: DailyTargets;
  hideNumbers?: boolean;
}

/** Makro Dağılımı Kartı: protein, karbonhidrat ve yağ ilerleme çubukları. */
export function MacroBalanceCard({ summary, targets, hideNumbers = false }: MacroBalanceCardProps) {
  return (
    <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Makro Besin Dengesi</h3>
          {!hideNumbers && <p className="text-xs text-slate-500 mt-0.5">Enerji dengesi: Protein ve Karb (4 kcal/g), Yağ (9 kcal/g)</p>}
        </div>
        <Link
          href="/nutrition"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
        >
          <span>Detaylı Plan</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-4">
        <MacroBar
          label="Protein"
          target={targets.proteinTargetG}
          consumed={summary?.consumedProtein}
          remaining={summary?.remainingProtein}
          percent={summary?.progressPercent?.protein}
          barClass="bg-emerald-500"
          hideNumbers={hideNumbers}
        />
        <MacroBar
          label="Karbonhidrat"
          target={targets.carbTargetG}
          consumed={summary?.consumedCarbs}
          remaining={summary?.remainingCarbs}
          percent={summary?.progressPercent?.carbs}
          barClass="bg-amber-500"
          hideNumbers={hideNumbers}
        />
        <MacroBar
          label="Sağlıklı Yağ"
          target={targets.fatTargetG}
          consumed={summary?.consumedFat}
          remaining={summary?.remainingFat}
          percent={summary?.progressPercent?.fat}
          barClass="bg-indigo-500"
          hideNumbers={hideNumbers}
        />
      </div>
    </div>
  );
}
