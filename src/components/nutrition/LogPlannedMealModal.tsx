"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useCreateFoodLog } from "@/lib/client/queries/nutrition";
import { formatNumberTr, parseDecimalTr } from "@/lib/format";
import type { MealType } from "@/lib/schemas/enums";
import type { PlannedMeal } from "@/lib/schemas/meal-plan";
import type { MatchRef, ParsedMealItem } from "@/lib/services/natural-log";
import { plannedMealName } from "./PlannedMealCard";

type Mode = "kcal" | "match";

const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const refKey = (r: MatchRef) => `${r.type}:${r.id}`;
const nowTime = () => new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

/** Boş alan "verilmedi" demektir (0 değil); geçersiz ya da negatif giriş de yok sayılmaz, hata olur. */
function optionalNumber(raw: string): number | undefined | null {
  if (!raw.trim()) return undefined;
  const v = parseDecimalTr(raw);
  return v !== null && v >= 0 ? v : null;
}

interface LogPlannedMealModalProps {
  /** Kaydedilecek planlı öğün; null iken pencere kapalıdır. */
  meal: PlannedMeal | null;
  date: string;
  onClose: () => void;
  /** Kayıt bitince: kaydedilen kalori (bilinmiyorsa null) ile çağrılır. */
  onLogged: (meal: PlannedMeal, kcal: number | null) => void;
}

/**
 * B09: tarifi olmayan (serbest metin) plan öğünü günlüğe yazar. İki yol vardır: kaloriyi (ve
 * isteğe bağlı makroları) elle girmek ya da öğün metnini katalogla eşleştirip gramla kaydetmek.
 */
export function LogPlannedMealModal({ meal, date, onClose, onLogged }: LogPlannedMealModalProps) {
  return (
    <Modal open={meal !== null} onClose={onClose} title="Planlı öğünü kaydet" widthClass="max-w-2xl">
      {/* Öğün değişince form sıfırlansın diye anahtar öğün kimliğidir. */}
      {meal && <LogPlannedMealForm key={meal.id} meal={meal} date={date} onClose={onClose} onLogged={onLogged} />}
    </Modal>
  );
}

function LogPlannedMealForm({ meal, date, onClose, onLogged }: { meal: PlannedMeal; date: string; onClose: () => void; onLogged: LogPlannedMealModalProps["onLogged"] }) {
  const name = plannedMealName(meal);
  const [mode, setMode] = useState<Mode>("kcal");
  const [fields, setFields] = useState({ kcal: "", protein: "", carbs: "", fat: "", grams: "" });
  const [edits, setEdits] = useState<Record<string, { grams?: number; choice?: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const createLog = useCreateFoodLog();

  // Eşleştirme yalnız o sekme açılınca bir kez istenir (kaydetmez; önizlemedir).
  const parsed = useQuery({
    queryKey: ["meal-plan-parse", meal.id, name],
    queryFn: () => apiFetch<{ items: ParsedMealItem[] }>("/api/food-logs/parse", { method: "POST", json: { text: name } }),
    enabled: mode === "match",
    staleTime: Infinity,
  });
  const rows = (parsed.data?.items ?? []).map((item, i) => {
    const key = `${i}:${item.raw}`;
    const edit = edits[key] ?? {};
    const grams = edit.grams ?? item.grams;
    const choice = edit.choice ?? (item.match ? refKey(item.match) : "");
    // Eşleşme değişmediyse kalori gramla orantılıdır; değiştiyse kayıtta sunucu hesaplar.
    const kcal =
      item.match && item.macros && item.grams && choice === refKey(item.match) && grams !== null
        ? Math.round((item.macros.calories * grams) / item.grams)
        : null;
    return { key, item, grams, choice, kcal };
  });
  const ready = rows.filter((r) => r.item.match && r.grams && r.grams > 0);

  const kcal = optionalNumber(fields.kcal);
  const extras = { protein: optionalNumber(fields.protein), carbs: optionalNumber(fields.carbs), fat: optionalNumber(fields.fat), grams: optionalNumber(fields.grams) };
  const kcalValid = typeof kcal === "number" && kcal > 0 && Object.values(extras).every((v) => v !== null);

  async function saveKcal() {
    if (!kcalValid) return;
    setSaving(true);
    setError(null);
    try {
      await createLog.mutateAsync({
        date,
        time: nowTime(),
        mealType: meal.mealType as MealType,
        name,
        caloriesSnapshot: kcal as number,
        ...(extras.protein !== undefined && { proteinSnapshot: extras.protein as number }),
        ...(extras.carbs !== undefined && { carbsSnapshot: extras.carbs as number }),
        ...(extras.fat !== undefined && { fatSnapshot: extras.fat as number }),
        ...(extras.grams !== undefined && extras.grams !== 0 && { grams: extras.grams as number }),
      });
      onLogged(meal, kcal as number);
    } catch (e) {
      setError(errorMessage(e, "Kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  }

  async function saveMatched() {
    setSaving(true);
    setError(null);
    try {
      const time = nowTime();
      for (const r of ready) {
        const chosen = [r.item.match!, ...r.item.alternatives].find((o) => refKey(o) === r.choice) ?? r.item.match!;
        await createLog.mutateAsync({
          date,
          time,
          mealType: meal.mealType as MealType,
          ...(chosen.type === "food" ? { foodItemId: chosen.id } : { recipeId: chosen.id }),
          name: chosen.name,
          grams: r.grams!,
        });
      }
      const known = ready.every((r) => r.kcal !== null);
      onLogged(meal, known ? ready.reduce((a, r) => a + (r.kcal ?? 0), 0) : null);
    } catch (e) {
      setError(errorMessage(e, "Kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  }

  const tab = (id: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === id}
      onClick={() => setMode(id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${mode === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-800 break-words">{name}</p>
      <p className="text-xs text-slate-500">Bu öğün bir tarife bağlı olmadığı için besin değeri bilinmiyor. Kaloriyi girerek ya da katalogla eşleştirerek kaydedebilirsin.</p>

      <div role="tablist" aria-label="Kayıt yolu" className="flex p-1 bg-slate-100 rounded-xl w-fit">
        {tab("kcal", "Kalori gir")}
        {tab("match", "Katalogla eşleştir")}
      </div>

      {mode === "kcal" ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(
            [
              ["kcal", "Kalori (kcal)"],
              ["protein", "Protein (g)"],
              ["carbs", "Karbonhidrat (g)"],
              ["fat", "Yağ (g)"],
              ["grams", "Miktar (g)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`log-plan-${key}`} className={LABEL}>
                {label}
              </label>
              <input
                id={`log-plan-${key}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={fields[key]}
                placeholder={key === "kcal" ? "Zorunlu" : "İsteğe bağlı"}
                onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                className={INPUT}
              />
            </div>
          ))}
        </div>
      ) : parsed.isPending ? (
        <p className="text-xs text-slate-400">Katalogda aranıyor...</p>
      ) : parsed.isError ? (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(parsed.error, "Metin çözümlenemedi.")}
        </p>
      ) : (
        <ul aria-label="Eşleşmeler" className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className={`p-3 rounded-xl border text-xs ${r.item.match ? "border-slate-200" : "border-rose-200 bg-rose-50"}`}>
              <p className="font-mono text-slate-500">{r.item.raw}</p>
              {r.item.match && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                  <select
                    aria-label={`${r.item.raw} eşleşmesi`}
                    value={r.choice}
                    onChange={(e) => setEdits({ ...edits, [r.key]: { ...edits[r.key], choice: e.target.value } })}
                    className={INPUT}
                  >
                    {[r.item.match, ...r.item.alternatives].map((o) => (
                      <option key={refKey(o)} value={refKey(o)}>
                        {o.name} {o.type === "recipe" ? "(tarif)" : ""}
                      </option>
                    ))}
                  </select>
                  <DecimalInput
                    aria-label={`${r.item.raw} gramı`}
                    value={r.grams}
                    onValueChange={(v) => setEdits({ ...edits, [r.key]: { ...edits[r.key], grams: v } })}
                    className={INPUT}
                  />
                  <span className="text-slate-700">{r.kcal !== null ? `${formatNumberTr(r.kcal)} kcal` : "Kaydedince katalogdan hesaplanır"}</span>
                </div>
              )}
              {r.item.note && <p className="mt-1 text-amber-800">{r.item.note}</p>}
            </li>
          ))}
          {rows.some((r) => !r.item.match) && (
            <li className="text-[11px] text-slate-500">Eşleşmeyen kalemler kaydedilmez. Kalorisini biliyorsan &quot;Kalori gir&quot; yolunu kullanabilirsin.</li>
          )}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
          Vazgeç
        </button>
        {mode === "kcal" ? (
          <button type="button" disabled={!kcalValid || saving} onClick={saveKcal} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
            Kaydet
          </button>
        ) : (
          <button type="button" disabled={!ready.length || saving} onClick={saveMatched} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
            {ready.length} kalemi kaydet
          </button>
        )}
      </div>
    </div>
  );
}
