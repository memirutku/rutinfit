"use client";

import { useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { MEAL_TYPES, mealTypeLabel, type MealType } from "@/lib/schemas/enums";
import type { RecentFood } from "@/lib/recent-foods";
import { errorMessage } from "@/lib/client/api";
import { formatNumberTr, parseDecimalTr } from "@/lib/format";
import { rankFoods } from "@/lib/food-search";
import { builtinMeasuresFor, mergeMeasures, recipeMeasuresFor, type MergedMeasure } from "@/lib/measures";
import { useRecipes } from "@/lib/client/queries/nutrition";
import { recipeTotals } from "@/components/foods/RecipesTab";
import { StarterCatalogPrompt } from "@/components/foods/StarterCatalogPrompt";

export interface QuickAddFood {
  id: string;
  name: string;
  calories: number;
  basisGrams: number;
}

export interface QuickAddValues {
  /** Katalog besini seçildiyse dolu; tarif seçildiyse boş ve `recipeId` dolu (B01). */
  foodItemId: string;
  recipeId?: string;
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

/** Tarif seçenekleri "recipe:" önekli değer taşır (besin kimlikleriyle karışmaz). */
const RECIPE_PREFIX = "recipe:";

/**
 * Hızlı öğün kaydı. Makrolar sunucuda katalog değerlerinden hesaplanır; burada yalnız seçim yapılır.
 * B01: tarifler de (porsiyonla) seçilebilir; katalog boşsa başlangıç kataloğu önerilir.
 */
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
  // F73: miktar gram ya da besinin ev ölçüsüyle girilir.
  const [unit, setUnit] = useState("gram");
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

  // B01: tarifler porsiyonla seçilir ("Mercimek Çorbası" aranınca çiğ mercimekten önce gelir).
  const recipesQuery = useRecipes(open);
  const recipeOptions = (recipesQuery.data ?? []).map((r) => {
    const totals = recipeTotals(r);
    const servings = r.servings > 0 ? r.servings : 1;
    const totalGrams = r.ingredients.reduce((a, i) => a + i.grams, 0);
    return {
      id: `${RECIPE_PREFIX}${r.id}`,
      recipeId: r.id,
      name: r.name,
      confidence: "Yüksek",
      portionKcal: totals.calories / servings,
      portionGrams: totalGrams / servings,
      instructions: r.instructions,
    };
  });

  // F02: arama kutusu listeyi süzer ve eşleşme kalitesine göre sıralar.
  const [query, setQuery] = useState("");
  const rank = (q: string) => ({
    foods: q.trim() ? rankFoods(foods, q) : foods,
    recipes: q.trim() ? rankFoods(recipeOptions, q) : recipeOptions,
    best: q.trim() ? rankFoods<{ id: string; name: string; confidence?: string | null }>([...foods, ...recipeOptions], q)[0] : foods[0] ?? recipeOptions[0],
  });
  const visible = rank(query);
  const visibleFoods = visible.foods;
  const catalogEmpty = !isLoadingFoods && foods.length === 0 && recipesQuery.isSuccess && recipeOptions.length === 0;

  const selectedRecipe = recipeOptions.find((r) => r.id === foodId);
  // Tarif porsiyonla, besin gramla başlar (porsiyondan besine geçince "1 gram" kalmasın).
  function selectItem(id: string) {
    const toRecipe = id.startsWith(RECIPE_PREFIX);
    if (toRecipe && !foodId.startsWith(RECIPE_PREFIX)) {
      setUnit("porsiyon");
      setGrams("1");
    } else if (!toRecipe && foodId.startsWith(RECIPE_PREFIX)) {
      setUnit("gram");
      setGrams("100");
    }
    setFoodId(id);
  }

  // Seçim yoksa listedeki en iyi eşleşme seçilir (seçim kapanıp açılınca korunur). Besin listesi
  // yüklenmeden seçilmez: tarifler önce gelirse varsayılan besin yerine tarif seçilmesin.
  if (open && !foodId && !isLoadingFoods && visible.best) selectItem(visible.best.id);

  // Son kullanılan bir besin 50'lik listede olmasa da seçilebilir (ad yerelden gelir).
  const recentOutsideList = recentFoods.filter((r) => !foods.some((f) => f.id === r.id));
  const selectedName =
    selectedRecipe?.name ?? foods.find((f) => f.id === foodId)?.name ?? recentFoods.find((r) => r.id === foodId)?.name;
  const measures: MergedMeasure[] = selectedRecipe
    ? recipeMeasuresFor(selectedRecipe.name, selectedRecipe.portionGrams, selectedRecipe.instructions).map((x) => ({ ...x, source: "builtin" as const }))
    : selectedName
      ? mergeMeasures(builtinMeasuresFor(selectedName), customMeasures?.[foodId] ?? [])
      : [];
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
      await onSubmit(
        selectedRecipe
          ? { foodItemId: "", recipeId: selectedRecipe.recipeId, name: selectedName, grams: gramsNum, mealType }
          : { foodItemId: foodId, name: selectedName, grams: gramsNum, mealType },
      );
    } catch (err) {
      setError(errorMessage(err, "Öğün kaydedilemedi."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Hızlı Öğün Kaydı" description="Katalogdan bir besin seçin veya son kullanılanlara tıklayın.">
      {catalogEmpty && (
        <div className="mb-4">
          <StarterCatalogPrompt />
        </div>
      )}
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
                  selectItem(rf.id);
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
              const r = rank(next);
              // Aramada en iyi eşleşme seçilir (besin ya da tarif).
              if (next.trim() || ![...r.foods, ...r.recipes].some((f) => f.id === foodId)) selectItem(r.best?.id ?? "");
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
            onChange={(e) => selectItem(e.target.value)}
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
            {visible.recipes.length > 0 ? (
              <>
                <optgroup label="Besinler">
                  {visibleFoods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({formatNumberTr(f.calories)} kcal / {formatNumberTr(f.basisGrams)}g)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Tarifler">
                  {visible.recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({formatNumberTr(Math.round(r.portionKcal))} kcal / porsiyon)
                    </option>
                  ))}
                </optgroup>
              </>
            ) : (
              visibleFoods.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({formatNumberTr(f.calories)} kcal / {formatNumberTr(f.basisGrams)}g)
                </option>
              ))
            )}
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
                if (e.target.value === "gram" && unit !== "gram" && Number.isFinite(gramsNum)) setGrams(String(gramsNum));
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
