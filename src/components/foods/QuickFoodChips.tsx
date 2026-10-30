"use client";

import { useState } from "react";
import { mealChoicesForTime } from "@/lib/meal-time";
import type { QuickFoodId } from "@/lib/quick-foods";
import { mealTypeLabel, type MealType } from "@/lib/schemas/enums";

/** Türk sofrası hızlı ekleme çipleri. */
export const QUICK_CHIPS: Array<{ label: string; item: QuickFoodId; count: number; name: string }> = [
  { label: "+ Simit", item: "simit", count: 1, name: "Simit" },
  { label: "+ 1 dilim ekmek", item: "ekmek-dilimi", count: 1, name: "1 dilim ekmek" },
  { label: "+ 2 dilim ekmek", item: "ekmek-dilimi", count: 2, name: "2 dilim ekmek" },
];

interface QuickFoodChipsProps {
  onQuickFood: (item: QuickFoodId, count: number, mealType: MealType) => void;
  ramadan?: boolean;
}

/**
 * F79 + B13: Tek tıkla simit/ekmek. Kalem saatin öğününe yazılır; saat bir öğün sınırına yakınsa
 * (ör. 10:50) önce "Hangi öğün?" diye sorulur.
 */
export function QuickFoodChips({ onQuickFood, ramadan = false }: QuickFoodChipsProps) {
  const [asking, setAsking] = useState<{ chip: (typeof QUICK_CHIPS)[number]; choices: MealType[] } | null>(null);

  function tap(chip: (typeof QUICK_CHIPS)[number]) {
    const choices = mealChoicesForTime(new Date(), ramadan);
    if (choices.length === 1) {
      setAsking(null);
      onQuickFood(chip.item, chip.count, choices[0]);
    } else setAsking({ chip, choices });
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase">Hızlı</span>
        {QUICK_CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => tap(c)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
          >
            {c.label}
          </button>
        ))}
      </div>
      {asking && (
        <div role="group" aria-label="Hangi öğün?" className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200">
          <span className="text-xs font-semibold text-amber-900">Hangi öğün? ({asking.chip.name})</span>
          {asking.choices.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setAsking(null);
                onQuickFood(asking.chip.item, asking.chip.count, m);
              }}
              className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-bold text-slate-800"
            >
              {mealTypeLabel(m, ramadan)}
            </button>
          ))}
          <button type="button" onClick={() => setAsking(null)} className="px-2 py-1 text-xs font-semibold text-slate-500">
            Vazgeç
          </button>
        </div>
      )}
    </div>
  );
}
