"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MoveRight, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { queryKeys } from "@/lib/client/queries/keys";
import { useRecipes } from "@/lib/client/queries/nutrition";
import { addDaysToDateString, startOfWeek } from "@/lib/date-utils";
import { formatDateTr, formatNumberTr } from "@/lib/format";
import { MEAL_TYPES, MEAL_TYPE_LABELS, type MealType } from "@/lib/schemas/enums";
import type { MealPlan, PlannedMeal } from "@/lib/schemas/meal-plan";

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";

type Editing =
  | { mode: "add"; date: string }
  | { mode: "move" | "copy"; meal: PlannedMeal; date: string };

const mealName = (m: PlannedMeal) => m.recipe?.name ?? m.customName ?? "Öğün";

/** F30: Haftalık plan editörü (Pazartesi–Pazar): ekle, taşı, kopyala, sil. Şablon yerine kayıtlı öğünler (F01) kullanılır. */
export function WeekPlanEditor({ selectedDate }: { selectedDate: string }) {
  const qc = useQueryClient();
  const weekStart = startOfWeek(selectedDate);
  const days = Array.from({ length: 7 }, (_, i) => addDaysToDateString(weekStart, i));
  const plans = useQuery({
    queryKey: [...queryKeys.mealPlans.all, "week", weekStart],
    queryFn: () => apiFetch<MealPlan[]>(`/api/meal-plans?weekStart=${weekStart}`),
  });
  const recipes = useRecipes();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [form, setForm] = useState({ date: "", mealType: "lunch" as MealType, recipeId: "", customName: "", servings: 1 });
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.mealPlans.all });
  const action = useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: string; body?: unknown }) => apiFetch(url, { method, json: body }),
    onSuccess: () => {
      setEditing(null);
      return invalidate();
    },
  });

  function open(next: Editing) {
    setEditing(next);
    const meal = next.mode === "add" ? undefined : next.meal;
    setForm({ date: next.date, mealType: (meal?.mealType as MealType) ?? "lunch", recipeId: "", customName: "", servings: meal?.servings ?? 1 });
  }

  function submit() {
    if (!editing) return;
    if (editing.mode === "add") {
      action.mutate({
        url: "/api/meal-plans/meals",
        method: "POST",
        body: {
          date: form.date,
          mealType: form.mealType,
          ...(form.recipeId ? { recipeId: form.recipeId } : { customName: form.customName.trim() }),
          servings: form.servings,
        },
      });
    } else if (editing.mode === "move") {
      action.mutate({ url: `/api/meal-plans/meals?id=${editing.meal.id}`, method: "PATCH", body: { date: form.date, mealType: form.mealType } });
    } else {
      action.mutate({ url: "/api/meal-plans/meals/copy", method: "POST", body: { id: editing.meal.id, toDate: form.date, toMealType: form.mealType } });
    }
  }

  const title = editing?.mode === "add" ? "Öğün ekle" : editing?.mode === "move" ? "Öğünü taşı" : "Öğünü kopyala";
  const canSave = editing?.mode !== "add" || !!form.recipeId || !!form.customName.trim();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {days.map((date, i) => {
          const plan = plans.data?.find((p) => p.date === date);
          const label = `${DAY_NAMES[i]} ${formatDateTr(date, { short: true })}`;
          return (
            <section key={date} aria-label={label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">{label}</h3>
                <button
                  type="button"
                  onClick={() => open({ mode: "add", date })}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Plus className="w-3 h-3" aria-hidden />+ Öğün
                </button>
              </div>
              {MEAL_TYPES.map((t) => {
                const meals = plan?.meals.filter((m) => m.mealType === t) ?? [];
                if (!meals.length) return null;
                return (
                  <div key={t}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{MEAL_TYPE_LABELS[t]}</p>
                    <ul className="space-y-1">
                      {meals.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-1 text-xs">
                          <span className="truncate">
                            {mealName(m)} <span className="text-slate-400">· {formatNumberTr(m.servings)} porsiyon</span>
                          </span>
                          <span className="shrink-0">
                            <button type="button" aria-label={`${mealName(m)} taşı`} onClick={() => open({ mode: "move", meal: m, date })} className="p-1 text-slate-400 hover:text-slate-700">
                              <MoveRight className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" aria-label={`${mealName(m)} kopyala`} onClick={() => open({ mode: "copy", meal: m, date })} className="p-1 text-slate-400 hover:text-slate-700">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`${mealName(m)} sil`}
                              onClick={() => action.mutate({ url: `/api/meal-plans/meals?id=${m.id}`, method: "DELETE" })}
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {!plan?.meals.length && <p className="text-xs text-slate-400">Plan yok</p>}
            </section>
          );
        })}
      </div>
      {action.isError && !editing && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(action.error, "İşlem yapılamadı.")}
        </p>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={title}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="wpe-date" className="block text-xs font-semibold text-slate-600 mb-1">
                Gün
              </label>
              <select id="wpe-date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={INPUT}>
                {days.map((d, i) => (
                  <option key={d} value={d}>
                    {DAY_NAMES[i]} {formatDateTr(d, { short: true })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="wpe-meal" className="block text-xs font-semibold text-slate-600 mb-1">
                Öğün
              </label>
              <select id="wpe-meal" value={form.mealType} onChange={(e) => setForm({ ...form, mealType: e.target.value as MealType })} className={INPUT}>
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MEAL_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {editing?.mode === "add" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="wpe-recipe" className="block text-xs font-semibold text-slate-600 mb-1">
                  Tarif
                </label>
                <select id="wpe-recipe" value={form.recipeId} onChange={(e) => setForm({ ...form, recipeId: e.target.value })} className={INPUT}>
                  <option value="">Tarif yok (ad yaz)</option>
                  {recipes.data?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="wpe-name" className="block text-xs font-semibold text-slate-600 mb-1">
                  Öğün adı
                </label>
                <input
                  id="wpe-name"
                  disabled={!!form.recipeId}
                  value={form.customName}
                  placeholder="Örn: diyetisyen planından"
                  onChange={(e) => setForm({ ...form, customName: e.target.value })}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="wpe-servings" className="block text-xs font-semibold text-slate-600 mb-1">
                  Porsiyon
                </label>
                <DecimalInput id="wpe-servings" value={form.servings} onValueChange={(v) => setForm({ ...form, servings: v })} className={INPUT} />
              </div>
            </div>
          )}
          {action.isError && (
            <p role="alert" className="text-xs text-rose-700">
              {errorMessage(action.error, "Kaydedilemedi.")}
            </p>
          )}
          <div className="flex justify-end">
            <button type="button" disabled={!canSave || action.isPending} onClick={submit} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
              Kaydet
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
