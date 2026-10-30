import { Barcode, Plus } from "lucide-react";
import type { FoodsTab } from "./constants";

interface FoodsHeaderProps {
  activeTab: FoodsTab;
  onTabChange: (tab: FoodsTab) => void;
  foodsCount: number;
  recipesCount: number;
  onNewFood: () => void;
  onNewRecipe: () => void;
  /** F33: adresten tarif içe aktarma. */
  onImportRecipe?: () => void;
  /** Paketli gıda sekmesinde: aranan adla manuel besin ekleme. */
  onManualAdd: () => void;
}

const TAB_BASE = "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors";
const TAB_ACTIVE = "bg-white text-slate-900 shadow-sm";
const TAB_IDLE = "text-slate-600 hover:text-slate-900";

/** Başlık, sekmeler ve sekmeye göre değişen "yeni" düğmesi. */
export function FoodsHeader({
  activeTab,
  onTabChange,
  foodsCount,
  recipesCount,
  onNewFood,
  onNewRecipe,
  onImportRecipe,
  onManualAdd,
}: FoodsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Besin & Tarif Kütüphanesi 📖</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Doğrulanmış 100g değerleri, Open Food Facts paketli gıda verisi ve deterministik tarif hesapları.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex p-1 bg-slate-100 rounded-xl">
          <button onClick={() => onTabChange("foods")} className={`${TAB_BASE} ${activeTab === "foods" ? TAB_ACTIVE : TAB_IDLE}`}>
            Besin Kataloğu ({foodsCount})
          </button>
          <button onClick={() => onTabChange("recipes")} className={`${TAB_BASE} ${activeTab === "recipes" ? TAB_ACTIVE : TAB_IDLE}`}>
            Tarifler ({recipesCount})
          </button>
          <button
            onClick={() => onTabChange("packaged")}
            className={`${TAB_BASE} flex items-center gap-1 ${activeTab === "packaged" ? `${TAB_ACTIVE} font-bold` : TAB_IDLE}`}
          >
            <Barcode className="w-3.5 h-3.5 text-brand-600" />
            <span>Paketli Gıda & Barkod</span>
          </button>
        </div>

        {activeTab === "foods" ? (
          <button
            onClick={onNewFood}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Besin</span>
          </button>
        ) : activeTab === "recipes" ? (
          <div className="flex items-center gap-2">
            {onImportRecipe && (
              <button
                type="button"
                onClick={onImportRecipe}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                <span>Adresten tarif</span>
              </button>
            )}
            <button
              onClick={onNewRecipe}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Tarif</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onManualAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Manuel Besin Ekle</span>
          </button>
        )}
      </div>
    </div>
  );
}
