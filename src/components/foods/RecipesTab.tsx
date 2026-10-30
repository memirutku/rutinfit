import { Flame } from "lucide-react";
import { calculateRecipeMacros } from "@/lib/nutrition-calculator";
import type { Macros, Recipe } from "@/lib/schemas/food";
import { formatNumberTr } from "@/lib/format";
import { recipePortionText } from "@/lib/measures";
import { TurkishCatalogBanner } from "./TurkishCatalogBanner";

/**
 * Kartta gösterilen tarif toplamı: sunucunun katalogdan hesapladığı `calculatedMacros`
 * (besinin `basisGrams` değerini dikkate alır). Yanıtta yoksa (ör. POST yanıtı) aynı
 * fonksiyonla istemcide hesaplanır; plan, "Yedim" ve öğün kaydıyla aynı sayılar çıkar.
 */
export function recipeTotals(recipe: Recipe): Macros {
  return recipe.calculatedMacros ?? calculateRecipeMacros(recipe.ingredients);
}

export function RecipesTab({ recipes }: { recipes: Recipe[] }) {
  return (
    <div className="space-y-4">
      <TurkishCatalogBanner />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>
    </div>
  );
}

/**
 * B11: Kartta öne çıkan sayı bir porsiyonun kalorisidir (yazarak eklemedeki "1 kase" ile aynı);
 * tencerenin tamamı alt satırda küçük yazılır. Makrolar da porsiyon başınadır.
 */
function RecipeCard({ recipe: r }: { recipe: Recipe }) {
  const totals = recipeTotals(r);
  const servings = r.servings > 0 ? r.servings : 1;
  const portion = { calories: totals.calories / servings, proteinG: totals.proteinG / servings, carbsG: totals.carbsG / servings, fatG: totals.fatG / servings };
  const portionKcal = Math.round(portion.calories);
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-base">{r.name}</h3>
          <p className="text-xs text-slate-500">
            Hazırlama: {r.prepMinutes} dk • {r.servings} porsiyon
            {servings > 1 && ` • tamamı ${formatNumberTr(Math.round(totals.calories))} kcal`}
          </p>
        </div>
        <div
          aria-label={`Porsiyon başına ${portionKcal} kcal`}
          className="shrink-0 flex flex-col items-end px-2.5 py-1 bg-brand-50 text-brand-700 rounded-lg"
        >
          <span className="flex items-center gap-1.5 font-bold text-xs">
            <Flame className="w-3.5 h-3.5" />
            {formatNumberTr(portionKcal)} kcal
          </span>
          <span className="text-[10px] font-semibold">/ {recipePortionText(r.instructions) ?? "porsiyon"}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-xl text-xs">
        <div>
          <div className="text-slate-400 text-[10px]">Protein</div>
          <div className="font-bold text-emerald-600">{formatNumberTr(Math.round(portion.proteinG))}g</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">Karbonhidrat</div>
          <div className="font-bold text-amber-600">{formatNumberTr(Math.round(portion.carbsG))}g</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">Yağ</div>
          <div className="font-bold text-purple-600">{formatNumberTr(Math.round(portion.fatG))}g</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-slate-700">Malzemeler:</div>
        <div className="text-xs text-slate-600 space-y-1">
          {r.ingredients.map((ing) => (
            <div key={ing.id} className="flex justify-between">
              <span>• {ing.foodItem.name}</span>
              <span className="font-medium">{formatNumberTr(ing.grams)}g</span>
            </div>
          ))}
        </div>
      </div>

      {r.instructions && (
        <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 italic">{r.instructions}</div>
      )}
    </div>
  );
}
