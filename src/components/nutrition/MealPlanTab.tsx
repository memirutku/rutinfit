"use client";

import { errorMessage } from "@/lib/client/api";
import { useAdherenceSummary, useCreateFoodLog, useMealPlans, useSetAdherence } from "@/lib/client/queries/nutrition";
import { addDaysToDateString, getLocalDateString, startOfWeek } from "@/lib/date-utils";
import type { PlannedMeal } from "@/lib/schemas/meal-plan";
import { DEFAULT_MEAL_TEMPLATES, PlannedMealCard } from "./PlannedMealCard";

interface MealPlanTabProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  /** Öğün tipine göre porsiyon çarpanı (sekme değişse de korunur). */
  multipliers: Record<string, number>;
  onMultiplierChange: (mealType: string, multiplier: number) => void;
  onMessage: (text: string, ms?: number) => void;
}

/** Yemek planı sekmesi: tarih seçici ve 4 temel öğün kartı. */
export function MealPlanTab({ selectedDate, onDateChange, multipliers, onMultiplierChange, onMessage }: MealPlanTabProps) {
  const mealPlans = useMealPlans(selectedDate);
  const createFoodLog = useCreateFoodLog();
  const setAdherence = useSetAdherence();
  const currentPlan = mealPlans.data?.[0] ?? null;
  // F78: seçili günün haftası (Pazartesi–Pazar) için plana uyum.
  const weekFrom = startOfWeek(selectedDate);
  const adherence = useAdherenceSummary(weekFrom, addDaysToDateString(weekFrom, 6));
  const percent = adherence.data?.percent;

  function handleLogPlannedMealAsEaten(meal: PlannedMeal | undefined, multiplier: number) {
    if (!meal?.recipeId || !meal.calculatedMacros) {
      onMessage("Bu öğüne bağlı bir tarif yok. Ana Panel'deki Hızlı Öğün ile kaydedebilirsiniz.", 4000);
      return;
    }
    // Gösterilen değerle kaydedilen değer aynı formülden gelir: planlanan porsiyon × çarpan.
    const scaledCalories = Math.round(meal.calculatedMacros.calories * multiplier);
    createFoodLog.mutate(
      {
        date: selectedDate,
        time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        mealType: meal.mealType,
        recipeId: meal.recipeId,
        name: meal.recipe?.name || meal.customName || "Planlanan Öğün",
        servings: (meal.servings || 1) * multiplier,
      },
      {
        onSuccess: () => {
          onMessage(
            `"${meal.recipe?.name || "Öğün"}" (${multiplier}x porsiyon - ${scaledCalories} kcal) günlüğe kaydedildi! ✓`,
            3000
          );
          // F78: işaretlenmemiş öğün yenince plana uygulandı sayılır.
          if (!meal.adherence) setAdherence.mutate({ plannedMealId: meal.id, adherence: "done" });
        },
        onError: (e) => onMessage(`Kaydedilemedi: ${errorMessage(e, "bilinmeyen hata")}`, 4000),
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarih Seçici */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <span className="text-sm font-semibold text-slate-700">Tarih:</span>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
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

      {/* 4 Temel Öğün Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {DEFAULT_MEAL_TEMPLATES.map((template) => {
          const planned = currentPlan?.meals.find((m) => m.mealType === template.type);
          const mult = multipliers[template.type] || 1;
          return (
            <PlannedMealCard
              key={template.type}
              template={template}
              planned={planned}
              multiplier={mult}
              onMultiplierChange={(m) => onMultiplierChange(template.type, m)}
              onLogEaten={() => handleLogPlannedMealAsEaten(planned, mult)}
              onAdherence={(value) => planned && setAdherence.mutate({ plannedMealId: planned.id, adherence: value })}
            />
          );
        })}
      </div>
    </div>
  );
}
