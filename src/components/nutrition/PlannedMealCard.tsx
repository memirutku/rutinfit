"use client";

import { Clock, Flame } from "lucide-react";
import type { PlannedMeal } from "@/lib/schemas/meal-plan";
import { ADHERENCE_LABELS, ADHERENCE_VALUES, type Adherence } from "@/lib/adherence";
import { formatNumberTr } from "@/lib/format";
import { DecimalInput } from "@/components/ui/DecimalInput";

export const PORTION_MULTIPLIERS = [0.5, 1.0, 1.5] as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Planlı öğünün görünen adı: bağlı tarifin adı, yoksa haftalık editörde yazılan ad. */
export const plannedMealName = (m: Pick<PlannedMeal, "recipe" | "customName">) => m.recipe?.name ?? m.customName ?? "Öğün";

interface PlannedMealCardProps {
  /** Haftalık editörde girilen planlı öğün (B08: gösterilen her şey bu kayıttan gelir). */
  meal: PlannedMeal;
  /** Öğün tipinin ekrandaki adı (Ramazan modunda Sahur/İftar). */
  label: string;
  multiplier: number;
  onMultiplierChange: (multiplier: number) => void;
  onLogEaten: () => void;
  /** F78: uyum işareti; aynı değere tekrar basılırsa null (işaret kalkar). */
  onAdherence?: (value: Adherence | null) => void;
  /** F56: kalori ve makro sayılarını gizle. */
  hideNumbers?: boolean;
}

const ADHERENCE_TONE: Record<Adherence, string> = {
  done: "bg-emerald-600 border-emerald-600 text-white",
  partial: "bg-amber-500 border-amber-500 text-white",
  skipped: "bg-slate-500 border-slate-500 text-white",
};

/**
 * Bir planlı öğün kartı. Tarife bağlıysa porsiyon çarpanı, besin değeri ve malzemeler gösterilir;
 * serbest metin öğünde (diyetisyen menüsü gibi) uydurma değer yerine açıklama çıkar.
 */
export function PlannedMealCard({ meal, label, multiplier: mult, onMultiplierChange, onLogEaten, onAdherence, hideNumbers = false }: PlannedMealCardProps) {
  const name = plannedMealName(meal);
  const macros = meal.calculatedMacros;
  const recipe = meal.recipe;

  return (
    <article aria-label={name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
          {meal.plannedTime && (
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5" aria-hidden />
              {meal.plannedTime}
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-2 break-words">{name}</h3>

        {macros ? (
          <>
            {/* Porsiyon Çarpanı Seçici (Tally UX esintisi) */}
            <div className="flex items-center gap-1.5 mb-2.5 bg-slate-50 p-1 rounded-lg w-fit">
              <span className="text-[10px] text-slate-400 font-semibold px-1">Porsiyon:</span>
              {PORTION_MULTIPLIERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onMultiplierChange(m)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    mult === m ? "bg-slate-900 text-white shadow-2xs" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {m}x
                </button>
              ))}
              {/* F31: serbest çarpan */}
              <DecimalInput
                aria-label="Porsiyon çarpanı"
                value={mult}
                onValueChange={(v) => v >= 0.25 && v <= 10 && onMultiplierChange(v)}
                className="w-12 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[11px] font-bold text-center"
              />
            </div>

            {!hideNumbers && (
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" aria-hidden />
                  {formatNumberTr(Math.round(macros.calories * mult))} kcal
                </span>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">P: {formatNumberTr(round1(macros.proteinG * mult))}g</span>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium">K: {formatNumberTr(round1(macros.carbsG * mult))}g</span>
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium">Y: {formatNumberTr(round1(macros.fatG * mult))}g</span>
              </div>
            )}

            {recipe?.ingredients && recipe.ingredients.length > 0 && (
              <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100 text-xs">
                <p className="font-semibold text-slate-700 mb-1.5">Malzemeler ({formatNumberTr(round1(meal.servings * mult))} porsiyon):</p>
                <ul className="space-y-1 text-slate-600">
                  {recipe.ingredients.map((ing) => (
                    <li key={ing.id} className="flex justify-between">
                      <span>• {ing.foodItem.name}</span>
                      <span className="font-medium text-slate-900">
                        {formatNumberTr(Math.round((ing.grams / (recipe.servings || 1)) * meal.servings * mult))} g
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="mb-4 text-xs text-slate-500">
            {formatNumberTr(meal.servings)} porsiyon · Tarife bağlı değil, besin değeri hesaplanamıyor. &quot;Yedim&quot; ile kalori girerek ya da
            katalogla eşleştirerek kaydedebilirsin.
          </p>
        )}

        {onAdherence && (
          <div className="flex items-center gap-1.5 mb-3" role="group" aria-label="Plana uyum">
            {ADHERENCE_VALUES.map((v) => {
              const active = meal.adherence === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onAdherence(active ? null : v)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    active ? ADHERENCE_TONE[v] : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {ADHERENCE_LABELS[v]}
                </button>
              );
            })}
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Recheck (Zeynep): günlüğe yazılan öğün ikinci kez yazılmasın. */}
          {meal.loggedAt ? (
            <button
              type="button"
              disabled
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold text-center"
            >
              Günlüğe yazıldı ✓
            </button>
          ) : (
            <button
              type="button"
              onClick={onLogEaten}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors text-center shadow-2xs"
            >
              {macros && mult !== 1 ? `${mult}x Porsiyon Olarak Kaydet` : "Yedim Olarak Kaydet"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
