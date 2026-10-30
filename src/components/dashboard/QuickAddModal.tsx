"use client";

import { useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { MEAL_TYPES, mealTypeLabel, type MealType } from "@/lib/schemas/enums";
import type { RecentFood } from "@/lib/recent-foods";
import { errorMessage } from "@/lib/client/api";
import { formatNumberTr, parseDecimalTr } from "@/lib/format";
import { rankFoods } from "@/lib/food-search";
import { builtinMeasuresFor, mergeMeasures } from "@/lib/measures";

export interface QuickAddFood {
  id: string;
  name: string;
  calories: number;
  basisGrams: number;
}

export interface QuickAddValues {
  foodItemId: string;
  name: string;
  grams: number;
  mealType: MealType;
}

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  foods: QuickAddFood[];
  isLoadingFoods: boolean;
  recentFoods: RecentFood[];
  initialMealType?: MealType;
  /** Hata fırlatırsa modal açık kalır ve mesaj gösterilir. */
  onSubmit: (values: QuickAddValues) => Promise<void>;
  /** F73: kullanıcının besin başına ölçüleri (besin kimliği → ölçüler). */
  customMeasures?: Record<string, Array<{ id: string; name: string; grams: number }>>;
  /** F76: Ramazan modunda sahur/iftar etiketleri. */
  ramadan?: boolean;
}

/** Hızlı öğün kaydı. Makrolar sunucuda katalog değerlerinden hesaplanır; burada yalnız seçim yapılır. */
export function QuickAddModal({
  open,
  onClose,
  foods,
  isLoadingFoods,
  recentFoods,
  initialMealType = "lunch",
  onSubmit,
  customMeasures,
  ramadan = false,
}: QuickAddModalProps) {
  const ids = { meal: useId(), search: useId(), food: useId(), grams: useId(), unit: useId() };
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [foodId, setFoodId] = useState("");
  const [grams, setGrams] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Her açılışta (ve açıkken öğün türü değişince) öğün türü ve hata sıfırlanır. Effect yerine
  // render sırasında ayarlanır: eski değerle bir kare çizilip hemen yeniden render edilmez.
  const openedWith = open ? initialMealType : null;
  const [lastOpenedWith, setLastOpenedWith] = useState(openedWith);
  if (openedWith !== lastOpenedWith) {
    setLastOpenedWith(openedWith);
    if (openedWith !== null) {
      setMealType(openedWith);
      setError(null);
    }
  }

  // F02: arama kutusu listeyi süzer ve eşleşme kalitesine göre sıralar.
  const [query, setQuery] = useState("");
  const visibleFoods = query.trim() ? rankFoods(foods, query) : foods;

  // Seçim yoksa listedeki ilk besin seçilir (seçim kapanıp açılınca korunur).
  if (open && !foodId && visibleFoods.length > 0) setFoodId(visibleFoods[0].id);

  // Son kullanılan bir besin 50'lik listede olmasa da seçilebilir (ad yerelden gelir).
  const recentOutsideList = recentFoods.filter((r) => !foods.some((f) => f.id === r.id));
  const selectedName = foods.find((f) => f.id === foodId)?.name ?? recentFoods.find((r) => r.id === foodId)?.name;
  // F73: miktar gram ya da besinin ev ölçüsüyle girilir.
  const [unit, setUnit] = useState("gram");
  const measures = selectedName ? mergeMeasures(builtinMeasuresFor(selectedName), customMeasures?.[foodId] ?? []) : [];
  const measure = unit === "gram" ? undefined : measures.find((x) => x.name === unit);
  if (unit !== "gram" && !measure) setUnit("gram");
  const amountNum = parseDecimalTr(grams) ?? NaN;
  const gramsNum = measure ? Math.round(amountNum * measure.grams * 10) / 10 : amountNum;
  const canSubmit = !!foodId && !!selectedName && gramsNum > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedName) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ foodItemId: foodId, name: selectedName, grams: gramsNum, mealType });
    } catch (err) {
      setError(errorMessage(err, "Öğün kaydedilemedi."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Hızlı Öğün Kaydı" description="Katalogdan bir besin seçin veya son kullanılanlara tıklayın.">
      {recentFoods.length > 0 && (
        <div className="mb-4">
          <span className="block text-xs font-semibold text-slate-600 mb-1.5">Son Kullanılanlar (Tek Tıkla Seç)</span>
          <div className="flex flex-wrap gap-1.5">
            {recentFoods.map((rf) => (
              <button
                key={rf.id}
                type="button"
                aria-pressed={foodId === rf.id}
                onClick={() => {
                  setFoodId(rf.id);
                  setUnit("gram");
                  setGrams(String(rf.defaultGrams));
                }}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  foodId === rf.id
                    ? "bg-brand-50 border-brand-300 text-brand-800 font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {rf.name} ({formatNumberTr(rf.defaultGrams)}g)
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={ids.meal} className="block text-xs font-semibold text-slate-700 mb-1">
            Öğün Türü
          </label>
          <select
            id={ids.meal}
            value={mealType}
            onChange={(e) => setMealType(e.target.value as MealType)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {MEAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {mealTypeLabel(t, ramadan)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={ids.search} className="block text-xs font-semibold text-slate-700 mb-1">
            Besin ara
          </label>
          <input
            id={ids.search}
            type="search"
            value={query}
            placeholder="Örn: sut, yulaf, tavuk gogus"
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              const list = next.trim() ? rankFoods(foods, next) : foods;
              if (!list.some((f) => f.id === foodId)) setFoodId(list[0]?.id ?? "");
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor={ids.food} className="block text-xs font-semibold text-slate-700 mb-1">
            Besin Seçin
          </label>
          <select
            id={ids.food}
            value={foodId}
            onChange={(e) => setFoodId(e.target.value)}
            disabled={isLoadingFoods}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            required
          >
            <option value="">{isLoadingFoods ? "Yükleniyor..." : "-- Listeden seçin --"}</option>
            {recentOutsideList.map((r) => (
              <option key={`recent-${r.id}`} value={r.id}>
                {r.name} (son kullanılan)
              </option>
            ))}
            {visibleFoods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({formatNumberTr(f.calories)} kcal / {formatNumberTr(f.basisGrams)}g)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={ids.grams} className="block text-xs font-semibold text-slate-700 mb-1">
              {unit === "gram" ? "Miktar (Gram)" : "Miktar"}
            </label>
            <input
              id={ids.grams}
              type="text"
              inputMode="decimal"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
            />
            {measure && Number.isFinite(gramsNum) && gramsNum > 0 && (
              <span className="block mt-1 text-[11px] text-slate-500">≈ {formatNumberTr(gramsNum)} g</span>
            )}
          </div>
          <div>
            <label htmlFor={ids.unit} className="block text-xs font-semibold text-slate-700 mb-1">
              Birim
            </label>
            <select
              id={ids.unit}
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                // Ölçüye geçince 1 ölçüyle başla (gramdaki 150 "150 kaşık" olmasın).
                if (e.target.value !== "gram" && unit === "gram") setGrams("1");
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="gram">gram</option>
              {measures.map((x) => (
                <option key={x.name} value={x.name}>
                  {x.name} ({formatNumberTr(x.grams)} g)
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">
            İptal
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Kaydediliyor..." : "Ekle"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
