"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useCreateFoodLog } from "@/lib/client/queries/nutrition";
import { useProfile } from "@/lib/client/queries/system";
import { formatNumberTr } from "@/lib/format";
import { MEAL_TYPES, mealTypeLabel, type MealType } from "@/lib/schemas/enums";
import type { FoodItem } from "@/lib/schemas/food";
import type { MatchRef, ParsedMealItem } from "@/lib/services/natural-log";
import { StarterCatalogPrompt } from "@/components/foods/StarterCatalogPrompt";
import { UnmatchedFoodActions, capitalizeTr, type ApproxEntry } from "@/components/foods/UnmatchedFoodActions";

interface Row extends ParsedMealItem {
  key: string;
  /** Seçili eşleşme ("food:id" / "recipe:id"). */
  choice: string;
  /** Çözümlemedeki gram (kalori bu orana göre ölçeklenir). */
  baseGrams: number | null;
  /** B10: bulunamayan satır için girilen yaklaşık kalori (serbest kayıt). */
  approx: ApproxEntry | null;
}

const refKey = (r: MatchRef) => `${r.type}:${r.id}`;
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";

/**
 * F06: "1 kase mercimek çorbası, 2 dilim ekmek" gibi yazılan öğün katalogla eşlenir; sayılar
 * katalogdan gelir ve kaynakları (eşleşen besin/tarif) gösterilir. Kullanıcı gram ve eşleşmeyi
 * düzeltip onaylar; kayıtta değerleri sunucu yeniden hesaplar.
 */
export function NaturalLogModal({ open, date, defaultMealType, onClose }: { open: boolean; date: string; defaultMealType: MealType; onClose: () => void }) {
  const [text, setText] = useState("");
  const [mealType, setMealType] = useState<MealType>(defaultMealType);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [catalogEmpty, setCatalogEmpty] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const createLog = useCreateFoodLog();
  // B10: Ramazan modunda öğün adları Sahur ve İftar.
  const ramadan = useProfile().data?.ramadanMode ?? false;
  const ready = (rows ?? []).filter((r) => (r.match ? !!r.grams && r.grams > 0 : !!r.approx && r.approx.kcal > 0));

  async function parse() {
    setParsing(true);
    setError(null);
    try {
      const { items, catalogEmpty: empty } = await apiFetch<{ items: ParsedMealItem[]; catalogEmpty?: boolean }>("/api/food-logs/parse", {
        method: "POST",
        json: { text },
      });
      setCatalogEmpty(!!empty);
      setRows(items.map((i, n) => ({ ...i, key: `${n}:${i.raw}`, choice: i.match ? refKey(i.match) : "", baseGrams: i.grams, approx: null })));
    } catch (e) {
      setError(errorMessage(e, "Metin çözümlenemedi."));
    } finally {
      setParsing(false);
    }
  }

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);

  /** Bulunamayan satırın tahmini gramı: gram yazıldıysa o, yoksa 100 g. */
  const guessGrams = (r: Row) => (r.unit === "gram" && r.quantity > 0 ? r.quantity : 100);

  /** B10: satır yeni eklenen besine bağlanır; değerler 100 g'den ölçeklenir. */
  function linkToNewFood(r: Row, food: FoodItem) {
    const grams = guessGrams(r);
    const basis = food.basisGrams > 0 ? food.basisGrams : 100;
    const f = grams / basis;
    const match: MatchRef = { type: "food", id: food.id, name: food.name };
    update(r.key, {
      match,
      choice: refKey(match),
      grams,
      baseGrams: grams,
      approx: null,
      macros: { calories: food.calories * f, proteinG: food.proteinG * f, carbsG: food.carbsG * f, fatG: food.fatG * f },
      note: r.unit && r.unit !== "gram" ? `"${r.unit}" için gram bilinmiyor; ${grams} g sayıldı, düzeltebilirsin.` : undefined,
    });
  }

  function close() {
    setText("");
    setRows(null);
    setCatalogEmpty(false);
    onClose();
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      for (const r of ready) {
        if (!r.match && r.approx) {
          // B10: katalog dışı serbest kayıt; değerleri kullanıcı girdi.
          await createLog.mutateAsync({
            date,
            time,
            mealType,
            name: `${capitalizeTr(r.food ?? r.raw)} (yaklaşık)`,
            grams: r.approx.grams,
            caloriesSnapshot: r.approx.kcal,
            proteinSnapshot: 0,
            carbsSnapshot: 0,
            fatSnapshot: 0,
          });
          continue;
        }
        const options = [r.match!, ...r.alternatives];
        const chosen = options.find((o) => refKey(o) === r.choice) ?? r.match!;
        await createLog.mutateAsync({
          date,
          time,
          mealType,
          ...(chosen.type === "food" ? { foodItemId: chosen.id } : { recipeId: chosen.id }),
          name: chosen.name,
          grams: r.grams!,
        });
      }
      close();
    } catch (e) {
      setError(errorMessage(e, "Kaydedilemedi."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Yazarak öğün ekle" description="Örn: 1 kase mercimek çorbası, 2 dilim ekmek, yarım bardak ayran" widthClass="max-w-2xl">
      <div className="space-y-3">
        <div>
          <label htmlFor="nl-text" className="block text-xs font-semibold text-slate-600 mb-1">
            Ne yedin?
          </label>
          <textarea id="nl-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} className={INPUT} />
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="nl-meal" className="block text-xs font-semibold text-slate-600 mb-1">
              Öğün
            </label>
            <select id="nl-meal" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} className={INPUT}>
              {MEAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {mealTypeLabel(t, ramadan)}
                </option>
              ))}
            </select>
          </div>
          <button type="button" disabled={!text.trim() || parsing} onClick={parse} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-50">
            Çözümle
          </button>
        </div>

        {catalogEmpty && <StarterCatalogPrompt onInstalled={parse} />}

        {rows && (
          <ul aria-label="Önizleme" className="space-y-2">
            {rows.map((r) => {
              // Eşleşme değişmediyse kalori gramla orantılıdır; değiştiyse kayıtta sunucu hesaplar.
              const kcal =
                r.match && r.macros && r.baseGrams && r.choice === refKey(r.match)
                  ? Math.round((r.macros.calories * (r.grams ?? 0)) / r.baseGrams)
                  : null;
              return (
                <li key={r.key} className={`p-3 rounded-xl border text-xs ${r.match ? "border-slate-200" : "border-rose-200 bg-rose-50"}`}>
                  <p className="font-mono text-slate-500">{r.raw}</p>
                  {r.match ? (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                      <select aria-label={`${r.raw} eşleşmesi`} value={r.choice} onChange={(e) => update(r.key, { choice: e.target.value })} className={INPUT}>
                        {[r.match, ...r.alternatives].map((o) => (
                          <option key={refKey(o)} value={refKey(o)}>
                            {o.name} {o.type === "recipe" ? "(tarif)" : ""}
                          </option>
                        ))}
                      </select>
                      <DecimalInput aria-label={`${r.raw} gramı`} value={r.grams} onValueChange={(v) => update(r.key, { grams: v })} className={INPUT} />
                      <span className="text-slate-700">
                        {kcal !== null ? `${formatNumberTr(kcal)} kcal` : "Kaydedince katalogdan hesaplanır"}
                      </span>
                    </div>
                  ) : (
                    <UnmatchedFoodActions
                      raw={r.raw}
                      food={r.food ?? r.raw}
                      defaultGrams={guessGrams(r)}
                      approx={r.approx}
                      onApprox={(approx) => update(r.key, { approx })}
                      onFoodCreated={(food) => linkToNewFood(r, food)}
                    />
                  )}
                  {r.note && <p className="mt-1 text-amber-800">{r.note}</p>}
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p role="alert" className="text-xs text-rose-700">
            {error}
          </p>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button type="button" disabled={!ready.length || saving} onClick={save} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
            {ready.length} kalemi kaydet
          </button>
        </div>
      </div>
    </Modal>
  );
}
