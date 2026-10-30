"use client";

import { useState } from "react";
import { GlassWater, X } from "lucide-react";
import { useAddDrink, useDeleteDrink, useDrinks } from "@/lib/client/queries/drinks";
import { CAFFEINE_DAILY_LIMIT_MG, DRINK_PRESETS } from "@/lib/drinks";
import { formatNumberTr } from "@/lib/format";
import { SUGARABLE_DRINKS, SUGAR_OPTIONS } from "@/lib/quick-foods";

const EVERYDAY = DRINK_PRESETS.filter((p) => p.kind !== "alcohol");
const ALCOHOL = DRINK_PRESETS.filter((p) => p.kind === "alcohol");

const BUTTON =
  "px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 disabled:opacity-50";

/** F13: Günlük sıvı, kafein ve alkol. Hazır içecekler tek tıkla eklenir. */
export function DrinksCard({ date }: { date: string }) {
  const drinks = useDrinks(date);
  const add = useAddDrink();
  const remove = useDeleteDrink();
  // F79: çay ve Türk kahvesine eklenecek şeker.
  const [sugarCubes, setSugarCubes] = useState(0);
  const addPreset = (presetId: string) =>
    add.mutate({ date, presetId, ...(SUGARABLE_DRINKS.has(presetId) && sugarCubes > 0 ? { sugarCubes } : {}) });
  const s = drinks.data?.summary;
  const hydration = s?.hydrationMl ?? 0;
  const target = s?.waterTargetMl ?? 2500;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Sıvı ve içecekler</span>
        <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
          <GlassWater className="w-4 h-4" />
        </div>
      </div>

      <div>
        <p className="text-2xl font-extrabold text-slate-900">
          {formatNumberTr(hydration)} / {formatNumberTr(target)} ml
        </p>
        <div className="mt-2 w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, s?.progressPercent ?? 0)}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          Çay ve kahve de sıvı ihtiyacına sayılır; alkol sayılmaz.
          {s && s.caffeineMg > 0 && ` Kafein: ${formatNumberTr(s.caffeineMg)} mg.`}
          {s && s.alcoholG > 0 && ` Alkol: ${formatNumberTr(s.standardDrinks)} standart içki.`}
        </p>
        {s?.caffeineHigh && (
          <p role="alert" className="mt-1.5 text-xs font-semibold text-amber-800">
            Bugün kafein günlük {CAFFEINE_DAILY_LIMIT_MG} mg sınırını aştı; uyku kaliteni etkileyebilir.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="drink-sugar" className="text-[11px] font-bold text-slate-500">
          Şeker (çay ve Türk kahvesi)
        </label>
        <select
          id="drink-sugar"
          value={sugarCubes}
          onChange={(e) => setSugarCubes(Number(e.target.value))}
          className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs"
        >
          {SUGAR_OPTIONS.map((o) => (
            <option key={o.cubes} value={o.cubes}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EVERYDAY.map((p) => (
          <button key={p.id} type="button" className={BUTTON} disabled={add.isPending} onClick={() => addPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase">Alkol</span>
        {ALCOHOL.map((p) => (
          <button key={p.id} type="button" className={BUTTON} disabled={add.isPending} onClick={() => addPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {(drinks.data?.logs.length ?? 0) > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {drinks.data!.logs.map((log) => (
            <li key={log.id} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-slate-100 text-[11px] text-slate-600">
              <span>
                {log.time} {log.name} {formatNumberTr(log.ml)} ml
              </span>
              <button
                type="button"
                aria-label={`${log.name} kaydını sil`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(log.id)}
                className="p-0.5 rounded-full hover:bg-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
