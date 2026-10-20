import { Flame } from "lucide-react";
import { calculateRecipeMacros } from "@/lib/nutrition-calculator";
import type { Macros, Recipe } from "@/lib/schemas/food";

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} />
      ))}
    </div>
  );
}

function RecipeCard({ recipe: r }: { recipe: Recipe }) {
  const totals = recipeTotals(r);
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base">{r.name}</h3>
          <p className="text-xs text-slate-500">
            Hazırlama: {r.prepMinutes} dk • {r.servings} porsiyon
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 text-brand-700 font-bold rounded-lg text-xs">
          <Flame className="w-3.5 h-3.5" />
          <span>{Math.round(totals.calories)} kcal</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-xl text-xs">
        <div>
          <div className="text-slate-400 text-[10px]">Protein</div>
          <div className="font-bold text-emerald-600">{Math.round(totals.proteinG)}g</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">Karbonhidrat</div>
          <div className="font-bold text-amber-600">{Math.round(totals.carbsG)}g</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">Yağ</div>
          <div className="font-bold text-purple-600">{Math.round(totals.fatG)}g</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-slate-700">Malzemeler:</div>
        <div className="text-xs text-slate-600 space-y-1">
          {r.ingredients.map((ing) => (
            <div key={ing.id} className="flex justify-between">
              <span>• {ing.foodItem.name}</span>
              <span className="font-medium">{ing.grams}g</span>
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
