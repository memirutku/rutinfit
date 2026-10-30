"use client";

import { useId, useState } from "react";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { errorMessage } from "@/lib/client/api";
import { useCreateFood } from "@/lib/client/queries/nutrition";
import type { FoodItem } from "@/lib/schemas/food";

const INPUT = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm";
const LABEL = "block text-[11px] font-semibold text-slate-600 mb-1";

/** "güllaç" → "Güllaç" (Türkçe büyük harf: "işkembe" → "İşkembe"). */
export function capitalizeTr(text: string): string {
  const t = text.trim();
  return t ? t[0].toLocaleUpperCase("tr-TR") + t.slice(1) : t;
}

export interface ApproxEntry {
  kcal: number;
  grams: number;
}

interface UnmatchedFoodActionsProps {
  /** Satırın ham metni (erişilebilir adlarda kullanılır). */
  raw: string;
  /** Ayrıştırılan besin metni (yeni besin adı buradan önerilir). */
  food: string;
  /** Tahmini gram (gram yazıldıysa o, yoksa 100). */
  defaultGrams: number;
  approx: ApproxEntry | null;
  onApprox: (value: ApproxEntry | null) => void;
  /** Yeni besin kataloğa eklenince satır ona bağlanır. */
  onFoodCreated: (food: FoodItem) => void;
}

/**
 * B10: Yazarak eklemede katalogda bulunamayan satır çıkmaz değildir: ön dolu formla yeni besin
 * olarak eklenir ya da yaklaşık kalori girilerek serbest kayıt olur.
 */
export function UnmatchedFoodActions({ raw, food, defaultGrams, approx, onApprox, onFoodCreated }: UnmatchedFoodActionsProps) {
  const [mode, setMode] = useState<"none" | "new" | "approx">(approx ? "approx" : "none");
  const ids = { name: useId(), kcal: useId(), protein: useId(), carbs: useId(), fat: useId() };
  const [form, setForm] = useState({ name: capitalizeTr(food), calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  const createFood = useCreateFood();

  async function saveFood() {
    try {
      const created = await createFood.mutateAsync({
        name: form.name.trim(),
        category: "Genel",
        basisGrams: 100,
        calories: form.calories,
        proteinG: form.proteinG,
        carbsG: form.carbsG,
        fatG: form.fatG,
        source: "Kullanıcı",
        confidence: "Kullanıcı",
      });
      onFoodCreated(created);
    } catch {
      // Hata aşağıda gösterilir; form açık kalır.
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={mode === "new"}
          onClick={() => {
            setMode("new");
            onApprox(null);
          }}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-700"
        >
          Yeni besin olarak ekle
        </button>
        <button
          type="button"
          aria-pressed={mode === "approx"}
          onClick={() => {
            setMode("approx");
            onApprox({ kcal: approx?.kcal ?? 0, grams: approx?.grams ?? defaultGrams });
          }}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-700"
        >
          Yaklaşık kalori gir
        </button>
      </div>

      {mode === "approx" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL}>
              Kalori (kcal)
              <DecimalInput
                aria-label={`${raw} yaklaşık kalori`}
                value={approx?.kcal ?? 0}
                onValueChange={(v) => onApprox({ kcal: Math.max(0, v), grams: approx?.grams ?? defaultGrams })}
                className={INPUT}
              />
            </label>
          </div>
          <div>
            <label className={LABEL}>
              Gram (tahmini)
              <DecimalInput
                aria-label={`${raw} tahmini gram`}
                value={approx?.grams ?? defaultGrams}
                onValueChange={(v) => onApprox({ kcal: approx?.kcal ?? 0, grams: v > 0 ? v : defaultGrams })}
                className={INPUT}
              />
            </label>
          </div>
        </div>
      )}

      {mode === "new" && (
        <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
          <div>
            <label htmlFor={ids.name} className={LABEL}>
              Yeni besin adı
            </label>
            <input id={ids.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                ["calories", ids.kcal, "Kalori (kcal/100 g)"],
                ["proteinG", ids.protein, "Protein (g/100 g)"],
                ["carbsG", ids.carbs, "Karbonhidrat (g/100 g)"],
                ["fatG", ids.fat, "Yağ (g/100 g)"],
              ] as const
            ).map(([key, id, label]) => (
              <div key={key}>
                <label htmlFor={id} className={LABEL}>
                  {label}
                </label>
                <DecimalInput id={id} value={form[key]} onValueChange={(v) => setForm({ ...form, [key]: Math.max(0, v) })} className={INPUT} />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">Değerleri ambalajdan ya da güvendiğin bir kaynaktan gir; "Genel" kategorisine "Kullanıcı" güveniyle kaydedilir.</p>
          <button
            type="button"
            disabled={!form.name.trim() || createFood.isPending}
            onClick={saveFood}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold disabled:opacity-50"
          >
            Besini kaydet
          </button>
          {createFood.isError && (
            <p role="alert" className="text-[11px] text-rose-700">
              {errorMessage(createFood.error, "Besin kaydedilemedi.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
