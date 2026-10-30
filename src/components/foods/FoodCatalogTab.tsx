import { useState } from "react";
import { Search } from "lucide-react";
import { rankFoods } from "@/lib/food-search";
import type { FoodItem } from "@/lib/schemas/food";
import { FOOD_CATEGORIES } from "./constants";
import { formatNumberTr } from "@/lib/format";
import { MeasuresModal } from "./MeasuresModal";

interface FoodCatalogTabProps {
  foods: FoodItem[];
  loading: boolean;
  loadError: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
}

/** Türkçe büyük/küçük harf duyarsız ad/marka araması ve kategori filtresi. */
/** F02: kategori süzgeci + Türkçe karakter gerektirmeyen, eşleşme kalitesine göre sıralı arama. */
export function filterFoods(foods: FoodItem[], search: string, category: string): FoodItem[] {
  const inCategory = foods.filter((f) => category === "all" || f.category === category);
  return search.trim() ? rankFoods(inCategory, search) : inCategory;
}

/** Besin kataloğu sekmesi: arama, kategori düğmeleri ve 100 g bazındaki besin kartları. */
export function FoodCatalogTab({
  foods,
  loading,
  loadError,
  search,
  onSearchChange,
  category,
  onCategoryChange,
}: FoodCatalogTabProps) {
  const filtered = filterFoods(foods, search, category);
  const [measuresFor, setMeasuresFor] = useState<FoodItem | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Besin ara (örn: tavuk, bulgur, yumurta)..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          {FOOD_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                category === cat
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat === "all" ? "Tümü" : cat}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p role="status" className="text-sm text-slate-500">
          Besin kataloğu yükleniyor...
        </p>
      )}
      {loadError && (
        <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {loadError}
        </p>
      )}
      {!loading && !loadError && filtered.length === 0 && (
        <p className="text-sm text-slate-500">Aramanıza uyan besin bulunamadı.</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((f) => (
          <FoodCard key={f.id} food={f} onMeasures={() => setMeasuresFor(f)} />
        ))}
      </div>
      <MeasuresModal open={measuresFor !== null} food={measuresFor} onClose={() => setMeasuresFor(null)} />
    </div>
  );
}

function FoodCard({ food: f, onMeasures }: { food: FoodItem; onMeasures: () => void }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-bold text-slate-900 text-sm">{f.name}</h4>
          <span className="text-[10px] text-slate-400">{f.category}</span>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            f.confidence === "Yüksek" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {f.confidence}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 text-center bg-slate-50 p-2 rounded-lg text-xs">
        <div>
          <div className="text-[10px] text-slate-400">Kalori</div>
          <div className="font-bold text-slate-800">{f.calories}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">Protein</div>
          <div className="font-bold text-emerald-600">{formatNumberTr(f.proteinG)}g</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">Karb</div>
          <div className="font-bold text-amber-600">{formatNumberTr(f.carbsG)}g</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">Yağ</div>
          <div className="font-bold text-purple-600">{formatNumberTr(f.fatG)}g</div>
        </div>
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        <span>{formatNumberTr(f.basisGrams)}g bazında</span>
        <button type="button" aria-label={`${f.name} ölçüleri`} onClick={onMeasures} className="font-semibold text-brand-700 hover:underline">
          Ölçüler
        </button>
        <span>{f.source}</span>
      </div>
    </div>
  );
}
