import { AlertCircle, Barcode, Download, Plus, Search } from "lucide-react";
import { keyedBy } from "@/lib/client/keys";
import type { PackagedProduct } from "@/lib/schemas/food";
import { QUICK_SEARCH_TAGS, isBarcode } from "./constants";
import { formatNumberTr } from "@/lib/format";

interface PackagedFoodTabProps {
  input: string;
  onInputChange: (value: string) => void;
  onSearch: (query: string) => void;
  loading: boolean;
  error: string | null;
  results: PackagedProduct[];
  /** Bulunamayan ürünü aranan adla manuel ekleme. */
  onManualAdd: () => void;
  onLogMeal: (product: PackagedProduct, grams: number) => void;
  onImport: (product: PackagedProduct) => void;
}

/** Open Food Facts araması: barkod veya ürün adı, hızlı etiketler ve sonuç kartları. */
export function PackagedFoodTab({
  input,
  onInputChange,
  onSearch,
  loading,
  error,
  results,
  onManualAdd,
  onLogMeal,
  onImport,
}: PackagedFoodTabProps) {
  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(input);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Barcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Barkod numarası (örn: 8690526011111) veya ürün adı (örn: Eti Lifalif Yulaf)..."
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors shadow-xs flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? "Aranıyor..." : "Ürün Ara"}</span>
          </button>
        </form>

        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
          <span className="text-slate-400 font-medium">Hızlı Arama:</span>
          {QUICK_SEARCH_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                onInputChange(tag);
                onSearch(tag);
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* ODbL Lisans ve Atıf Uyarısı */}
        <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>
            Veriler <strong>Open Food Facts</strong> açık veritabanından (ODbL lisansı) canlı veya yerel önbellekten
            sorgulanır.
          </span>
          <span className="font-semibold text-slate-500">Yerel-First Cache Aktif</span>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
          <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm text-amber-900 font-semibold">{error}</p>
          <button
            onClick={onManualAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isBarcode(input) ? "Etiketten ekle" : "Bu Ürünü Özel Olarak Kataloğa Ekle"}</span>
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {keyedBy(results, (p) => p.barcode ?? `${p.brand ?? ""}:${p.name}`).map(({ key, item }) => (
            <ProductCard key={key} product={item} onLogMeal={onLogMeal} onImport={onImport} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ProductCardProps {
  product: PackagedProduct;
  onLogMeal: (product: PackagedProduct, grams: number) => void;
  onImport: (product: PackagedProduct) => void;
}

function ProductCard({ product, onLogMeal, onImport }: ProductCardProps) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
      <div className="flex items-start justify-between">
        <div>
          {product.brand && (
            <span className="text-[11px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">{product.brand}</span>
          )}
          <h4 className="font-bold text-slate-900 text-base mt-1">{product.name}</h4>
          {product.barcode && <p className="text-xs text-slate-400 font-mono mt-0.5">Barkod: {product.barcode}</p>}
        </div>

        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
            product.confidence === "Yüksek"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {product.confidence === "Yüksek" ? "Doğrulanmış" : "Tahmini Değer"}
        </span>
      </div>

      {/* 100g Makrolar */}
      <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 p-2.5 rounded-xl text-xs">
        <div>
          <div className="text-slate-400 text-[10px]">Kalori</div>
          <div className="font-bold text-orange-600">{product.calories} kcal</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">Protein</div>
          <div className="font-bold text-emerald-600">{formatNumberTr(product.proteinG)}g</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">Karb</div>
          <div className="font-bold text-amber-600">{formatNumberTr(product.carbsG)}g</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">Yağ</div>
          <div className="font-bold text-purple-600">{formatNumberTr(product.fatG)}g</div>
        </div>
      </div>

      {product.uncertainties && product.uncertainties.length > 0 && (
        <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg">{product.uncertainties.join(" • ")}</div>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 italic">Kaynak: Open Food Facts</span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onLogMeal(product, 100)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            +100g Öğün Ekle
          </button>
          <button
            onClick={() => onImport(product)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
          >
            <Download className="w-3 h-3" />
            <span>Kataloğa Kaydet</span>
          </button>
        </div>
      </div>
    </div>
  );
}
