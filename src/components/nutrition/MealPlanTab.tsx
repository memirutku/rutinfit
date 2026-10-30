"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { useAdherenceSummary, useCreateFoodLog, useMarkPlannedMealLogged, useMealPlans, useSetAdherence } from "@/lib/client/queries/nutrition";
import { plannedMealLogTime } from "@/lib/meal-time";
import { addDaysToDateString, getLocalDateString, startOfWeek } from "@/lib/date-utils";
import { formatDecimalTr, formatNumberTr } from "@/lib/format";
import { MEAL_TYPES, mealTypeLabel, type MealType } from "@/lib/schemas/enums";
import type { PlannedMeal } from "@/lib/schemas/meal-plan";
import { PlannedMealCard, plannedMealName } from "./PlannedMealCard";
import { LogPlannedMealModal } from "./LogPlannedMealModal";

interface MealPlanTabProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  /** Planlı öğün kimliğine göre porsiyon çarpanı (sekme değişse de korunur). */
  multipliers: Record<string, number>;
  onMultiplierChange: (mealId: string, multiplier: number) => void;
  onMessage: (text: string, ms?: number) => void;
  /** Boş günde "Hafta'dan ekle": haftalık editörü açar. */
  onOpenWeek: () => void;
  /** F76: Ramazan modunda kahvaltı/akşam yemeği Sahur/İftar diye yazılır. */
  ramadan?: boolean;
  /** F56: kalori ve makro sayılarını gizle. */
  hideNumbers?: boolean;
}

const mealOrder = (t: string) => {
  const i = MEAL_TYPES.indexOf(t as MealType);
  return i === -1 ? MEAL_TYPES.length : i;
};

/** Günün planlı öğünleri öğün sırasına (kahvaltı → ekstra), aynı öğünde planlanan saate göre dizilir. */
export function sortPlannedMeals(meals: PlannedMeal[]): PlannedMeal[] {
  return [...meals].sort((a, b) => mealOrder(a.mealType) - mealOrder(b.mealType) || (a.plannedTime ?? "").localeCompare(b.plannedTime ?? ""));
}

/** B08: Yemek planı sekmesi. Seçili günün haftalık editörde girilen öğünlerini gösterir; plan yoksa boş durum. */
export function MealPlanTab({ selectedDate, onDateChange, multipliers, onMultiplierChange, onMessage, onOpenWeek, ramadan = false, hideNumbers = false }: MealPlanTabProps) {
  const mealPlans = useMealPlans(selectedDate);
  const createFoodLog = useCreateFoodLog();
  const setAdherence = useSetAdherence();
  const markLogged = useMarkPlannedMealLogged();
  const meals = sortPlannedMeals(mealPlans.data?.flatMap((p) => p.meals) ?? []);
  // F78: seçili günün haftası (Pazartesi–Pazar) için plana uyum.
  const weekFrom = startOfWeek(selectedDate);
  const adherence = useAdherenceSummary(weekFrom, addDaysToDateString(weekFrom, 6));
  const percent = adherence.data?.percent;
  // B09: tarifsiz öğün "Yedim" ile kalori girilerek ya da katalogla eşlenerek kaydedilir.
  const [logging, setLogging] = useState<PlannedMeal | null>(null);

  /** F78: işaretlenmemiş öğün yenince plana uygulandı sayılır. Recheck: öğün "günlüğe yazıldı" olarak da işaretlenir. */
  function markDone(meal: PlannedMeal) {
    if (!meal.adherence) setAdherence.mutate({ plannedMealId: meal.id, adherence: "done" });
    markLogged.mutate(meal.id);
  }

  function handleFreeMealLogged(meal: PlannedMeal, kcal: number | null) {
    setLogging(null);
    const detail = kcal === null || hideNumbers ? "" : ` (${formatNumberTr(Math.round(kcal))} kcal)`;
    onMessage(`"${plannedMealName(meal)}"${detail} günlüğe kaydedildi! ✓`, 3000);
    markDone(meal);
  }

  function handleLogPlannedMealAsEaten(meal: PlannedMeal, multiplier: number) {
    if (!meal.recipeId || !meal.calculatedMacros) {
      setLogging(meal);
      return;
    }
    // Gösterilen değerle kaydedilen değer aynı formülden gelir: planlanan porsiyon × çarpan.
    const scaledCalories = Math.round(meal.calculatedMacros.calories * multiplier);
    const name = plannedMealName(meal);
    createFoodLog.mutate(
      {
        date: selectedDate,
        time: plannedMealLogTime(meal.mealType as MealType, meal.plannedTime),
        mealType: meal.mealType as MealType,
        recipeId: meal.recipeId,
        name,
        servings: (meal.servings || 1) * multiplier,
      },
      {
        onSuccess: () => {
          const detail = hideNumbers
            ? `${formatDecimalTr(multiplier)}× porsiyon`
            : `${formatDecimalTr(multiplier)}× porsiyon - ${formatNumberTr(scaledCalories)} kcal`;
          onMessage(`"${name}" (${detail}) günlüğe kaydedildi! ✓`, 3000);
          markDone(meal);
        },
        onError: (e) => onMessage(`Kaydedilemedi: ${errorMessage(e, "bilinmeyen hata")}`, 4000),
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarih Seçici */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <label htmlFor="meal-plan-date" className="text-sm font-semibold text-slate-700">
          Tarih:
        </label>
        <input
          id="meal-plan-date"
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={() => onDateChange(getLocalDateString())}
          className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold"
        >
          Bugüne Git
        </button>
      </div>

      {typeof percent === "number" && (
        <p role="status" className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold">
          Bu hafta plana uyum: %{percent}{" "}
          <span className="font-normal text-emerald-800">
            (işaretli öğün: {adherence.data!.marked} · uygulandı: {adherence.data!.done} · kısmen: {adherence.data!.partial} ·
            atlandı: {adherence.data!.skipped})
          </span>
        </p>
      )}

      {mealPlans.isPending ? (
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      ) : mealPlans.isError ? (
        <p role="alert" className="text-sm text-rose-700">
          {errorMessage(mealPlans.error, "Yemek planı getirilemedi.")}
        </p>
      ) : meals.length === 0 ? (
        <section aria-label="Plan yok" className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
          <CalendarPlus className="w-8 h-8 text-slate-400 mx-auto" aria-hidden />
          <p className="font-semibold text-slate-800">Bu gün için planlı öğün yok.</p>
          <p className="text-sm text-slate-500">Diyetisyeninin verdiği ya da kendi menünü Hafta sekmesinde gün gün girebilirsin; burada o günün öğünleri görünür.</p>
          <a
            href="#hafta"
            onClick={(e) => {
              e.preventDefault();
              onOpenWeek();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
          >
            Hafta&apos;dan ekle
          </a>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {meals.map((meal) => {
            const mult = multipliers[meal.id] || 1;
            return (
              <PlannedMealCard
                key={meal.id}
                meal={meal}
                label={MEAL_TYPES.includes(meal.mealType as MealType) ? mealTypeLabel(meal.mealType as MealType, ramadan) : meal.mealType}
                multiplier={mult}
                hideNumbers={hideNumbers}
                onMultiplierChange={(m) => onMultiplierChange(meal.id, m)}
                onLogEaten={() => handleLogPlannedMealAsEaten(meal, mult)}
                onAdherence={(value) => setAdherence.mutate({ plannedMealId: meal.id, adherence: value })}
              />
            );
          })}
        </div>
      )}

      <LogPlannedMealModal meal={logging} date={selectedDate} onClose={() => setLogging(null)} onLogged={handleFreeMealLogged} />
    </div>
  );
}
