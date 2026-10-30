"use client";

import { Clock, Flame } from "lucide-react";
import type { MealType } from "@/lib/schemas/enums";
import type { PlannedMeal } from "@/lib/schemas/meal-plan";

/** Günlük öğün planı yoksa gösterilen varsayılan dağılım rehberi. */
export interface MealTemplate {
  type: MealType;
  title: string;
  targetKcal: number;
  targetProtein: number;
  example: string;
  time: string;
}

export const DEFAULT_MEAL_TEMPLATES: MealTemplate[] = [
  {
    type: "breakfast",
    title: "Kahvaltı",
    targetKcal: 430,
    targetProtein: 35,
    example: "Yulaflı Lorlu Fit Omlet & Çay",
    time: "07:00 - 07:30",
  },
  {
    type: "lunch",
    title: "Öğle Yemeği",
    targetKcal: 620,
    targetProtein: 45,
    example: "Izgara Tavuklu Bulgur Pilavı & Yoğurt",
    time: "12:30 - 13:00",
  },
  {
    type: "workSnack",
    title: "İş Çıkışı Ara Öğünü",
    targetKcal: 280,
    targetProtein: 20,
    example: "Muzlu Yoğurt & Lor Kasesi (İş yerinde pratik)",
    time: "17:00 (İşten çıkmadan önce)",
  },
  {
    type: "dinner",
    title: "Akşam Yemeği",
    targetKcal: 750,
    targetProtein: 65,
    example: "Fırın Tavuk Göğsü, Fırın Patates & Yoğurt",
    time: "20:30 (Antrenman sonrası)",
  },
];

export const PORTION_MULTIPLIERS = [0.5, 1.0, 1.5] as const;

const round1 = (n: number) => Math.round(n * 10) / 10;

interface PlannedMealCardProps {
  template: MealTemplate;
  /** Veritabanında bu öğün tipi için planlanan öğün (yoksa rehber gösterilir). */
  planned: PlannedMeal | undefined;
  multiplier: number;
  onMultiplierChange: (multiplier: number) => void;
  onLogEaten: () => void;
}

/** Bir öğün kartı: porsiyon çarpanı, makro rozetleri, malzemeler ve "Yedim" düğmesi. */
export function PlannedMealCard({ template, planned, multiplier: mult, onMultiplierChange, onLogEaten }: PlannedMealCardProps) {
  const macros = planned?.calculatedMacros;
  const cal = Math.round((macros?.calories || template.targetKcal) * mult);
  const pro = round1((macros?.proteinG || template.targetProtein) * mult);
  const carb = round1((macros?.carbsG || 40) * mult);
  const fat = round1((macros?.fatG || 10) * mult);
  const recipe = planned?.recipe;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{template.title}</span>
          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
            <Clock className="w-3.5 h-3.5" />
            {template.time}
          </span>
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-2">{recipe?.name || template.example}</h3>

        {/* Porsiyon Çarpanı Seçici (Tally UX esintisi) */}
        <div className="flex items-center gap-1.5 mb-2.5 bg-slate-50 p-1 rounded-lg w-fit">
          <span className="text-[10px] text-slate-400 font-semibold px-1">Porsiyon:</span>
          {PORTION_MULTIPLIERS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMultiplierChange(m)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                mult === m
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {m}x
            </button>
          ))}
        </div>

        {/* Makro Hedef ve Gerçekleşen Rozetleri */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" />
            {cal} kcal
          </span>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">P: {pro}g</span>
          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium">K: {carb}g</span>
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium">Y: {fat}g</span>
        </div>

        {/* Malzeme listesi (tarif varsa) */}
        {planned && recipe?.ingredients && (
          <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100 text-xs">
            <p className="font-semibold text-slate-700 mb-1.5">
              Malzemeler ({round1(planned.servings * mult)} porsiyon):
            </p>
            <ul className="space-y-1 text-slate-600">
              {recipe.ingredients.map((ing) => (
                <li key={ing.id} className="flex justify-between">
                  <span>• {ing.foodItem.name}</span>
                  <span className="font-medium text-slate-900">
                    {Math.round((ing.grams / (recipe.servings || 1)) * planned.servings * mult)} g
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={onLogEaten}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors text-center shadow-2xs"
          >
            {mult !== 1 ? `${mult}x Porsiyon Olarak Kaydet` : "Yedim Olarak Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
