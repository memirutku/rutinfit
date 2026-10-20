"use client";

import { useEffect, useState } from "react";
import { includesTr } from "@/lib/text";
import { Modal } from "@/components/ui/Modal";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  Search,
  Plus,
  Check,
  Flame,
  Barcode,
  AlertCircle,
  Download,
} from "lucide-react";
import { getLocalDateString } from "@/lib/date-utils";

export default function FoodsPage() {
  const [activeTab, setActiveTab] = useState<"foods" | "recipes" | "packaged">("foods");
  const [foods, setFoods] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Open Food Facts state
  const [packagedInput, setPackagedInput] = useState("");
  const [packagedLoading, setPackagedLoading] = useState(false);
  const [packagedResults, setPackagedResults] = useState<any[]>([]);
  const [packagedError, setPackagedError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Yeni besin modalı
  const [isNewFoodOpen, setIsNewFoodOpen] = useState(false);
  const [foodForm, setFoodForm] = useState({
    name: "",
    category: "Kasap & Balık",
    basisGrams: 100,
    calories: 120,
    proteinG: 20,
    carbsG: 0,
    fatG: 2,
    source: "Kullanıcı",
    confidence: "Yüksek",
  });

  // Yeni tarif modalı
  const [isNewRecipeOpen, setIsNewRecipeOpen] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    name: "",
    instructions: "",
    prepMinutes: 15,
    servings: 1,
    ingredients: [{ foodItemId: "", grams: 100 }],
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Hata gövdesi (ör. { error }) diziye yazılırsa .filter çöküyordu; yalnız başarılı yanıt kullanılır.
      const [foodsJson, recipesJson] = await Promise.all([
        apiFetch<any[]>("/api/foods?limit=200"),
        apiFetch<any[]>("/api/recipes"),
      ]);
      setFoods(Array.isArray(foodsJson) ? foodsJson : []);
      setRecipes(Array.isArray(recipesJson) ? recipesJson : []);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e, "Besin kataloğu yüklenemedi."));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFood(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(foodForm),
      });
      setIsNewFoodOpen(false);
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreateRecipe(e: React.FormEvent) {
    e.preventDefault();
    try {
      const validIngredients = recipeForm.ingredients.filter(
        (i) => i.foodItemId && i.grams > 0
      );
      if (validIngredients.length === 0) return;

      await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...recipeForm,
          ingredients: validIngredients,
        }),
      });
      setIsNewRecipeOpen(false);
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  // Open Food Facts arama fonksiyonu
  async function handlePackagedSearch(queryToSearch?: string) {
    const q = (queryToSearch || packagedInput).trim();
    if (!q) return;

    setPackagedLoading(true);
    setPackagedError(null);
    setPackagedResults([]);

    try {
      const isBarcode = /^[0-9]{6,14}$/.test(q);
      const url = isBarcode
        ? `/api/foods/barcode?barcode=${encodeURIComponent(q)}`
        : `/api/foods/barcode?query=${encodeURIComponent(q)}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Arama başarısız.");
      }

      if (data.product) {
        setPackagedResults([data.product]);
      } else if (data.products && data.products.length > 0) {
        setPackagedResults(data.products);
      } else {
        setPackagedError(`"${q}" için ürün bulunamadı. Lütfen manuel ekleyin.`);
      }
    } catch (err: any) {
      setPackagedError(err.message || "Arama sırasında bağlantı hatası oluştu.");
    } finally {
      setPackagedLoading(false);
    }
  }

  // Ürünü doğrudan yerel FoodItem kataloğuna kaydetme
  async function handleImportToCatalog(product: any) {
    try {
      const res = await fetch("/api/foods/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: product.barcode,
          name: product.name,
          brand: product.brand,
          basisGrams: product.basisGrams || 100,
          calories: product.calories,
          proteinG: product.proteinG,
          carbsG: product.carbsG,
          fatG: product.fatG,
          category: product.categories?.[0] || "Paketli Gıda",
          confidence: product.confidence || "Yüksek",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kataloğa kaydedilemedi");

      setActionNotice({
        type: "success",
        text: `"${product.name}" başarıyla yerel kataloğunuza kaydedildi.`,
      });
      loadData();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Hata oluştu." });
      setTimeout(() => setActionNotice(null), 4000);
    }
  }

  // Ürünü doğrudan bugünkü besin günlüğüne kaydetme
  async function handleLogProductAsMeal(product: any, grams = 100) {
    const todayStr = getLocalDateString();
    const factor = grams / (product.basisGrams || 100);

    try {
      const res = await fetch("/api/food-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
          mealType: "extra",
          name: product.brand ? `${product.brand} - ${product.name}` : product.name,
          grams,
          caloriesSnapshot: Math.round(product.calories * factor),
          proteinSnapshot: Math.round(product.proteinG * factor * 10) / 10,
          carbsSnapshot: Math.round(product.carbsG * factor * 10) / 10,
          fatSnapshot: Math.round(product.fatG * factor * 10) / 10,
        }),
      });

      if (!res.ok) throw new Error("Öğün kaydedilemedi.");

      setActionNotice({
        type: "success",
        text: `"${product.name}" (${grams}g) bugünkü günlüğe eklendi!`,
      });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Hata oluştu." });
      setTimeout(() => setActionNotice(null), 4000);
    }
  }

  const categories = [
    "all",
    "Kasap & Balık",
    "Süt Ürünleri & Yumurta",
    "Kuru Gıda & Tahıllar",
    "Manav (Sebze & Meyve)",
    "Bakliyatlar",
    "Yağlar & Soslar",
  ];

  const quickSearchTags = [
    "Yulaf Ezmesi",
    "Protein Bar",
    "Ton Balığı",
    "Kefir",
    "Yer Fıstığı Ezmesi",
    "Süt",
    "Labne",
  ];

  const filteredFoods = foods.filter((f) => {
    const matchesSearch = includesTr(f.name, search) || includesTr(f.brand, search);
    const matchesCategory =
      selectedCategory === "all" || f.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Üst Başlık ve Sekmeler */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Besin & Tarif Kütüphanesi 📖
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Doğrulanmış 100g değerleri, Open Food Facts paketli gıda verisi ve deterministik tarif hesapları.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab("foods")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "foods"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Besin Kataloğu ({foods.length})
            </button>
            <button
              onClick={() => setActiveTab("recipes")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "recipes"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tarifler ({recipes.length})
            </button>
            <button
              onClick={() => setActiveTab("packaged")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                activeTab === "packaged"
                  ? "bg-white text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Barcode className="w-3.5 h-3.5 text-brand-600" />
              <span>Paketli Gıda & Barkod</span>
            </button>
          </div>

          {activeTab === "foods" ? (
            <button
              onClick={() => setIsNewFoodOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Besin</span>
            </button>
          ) : activeTab === "recipes" ? (
            <button
              onClick={() => setIsNewRecipeOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Tarif</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setFoodForm({ ...foodForm, name: packagedInput });
                setIsNewFoodOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Manuel Besin Ekle</span>
            </button>
          )}
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
            actionNotice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {actionNotice.type === "success" ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* PAKETLİ GIDA & BARKOD SEKMESİ (Open Food Facts Entegrasyonu) */}
      {activeTab === "packaged" && (
        <div className="space-y-5">
          {/* Arama Alanı */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePackagedSearch();
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Barkod numarası (örn: 8690526011111) veya ürün adı (örn: Eti Lifalif Yulaf)..."
                  value={packagedInput}
                  onChange={(e) => setPackagedInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={packagedLoading || !packagedInput.trim()}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors shadow-xs flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>{packagedLoading ? "Aranıyor..." : "Ürün Ara"}</span>
              </button>
            </form>

            {/* Hızlı Arama Etiketleri */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
              <span className="text-slate-400 font-medium">Hızlı Arama:</span>
              {quickSearchTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setPackagedInput(tag);
                    handlePackagedSearch(tag);
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
                Veriler <strong>Open Food Facts</strong> açık veritabanından (ODbL lisansı) canlı veya yerel önbellekten sorgulanır.
              </span>
              <span className="font-semibold text-slate-500">Yerel-First Cache Aktif</span>
            </div>
          </div>

          {/* Hata veya Bulunamadı Kartı */}
          {packagedError && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
              <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-sm text-amber-900 font-semibold">{packagedError}</p>
              <button
                onClick={() => {
                  setFoodForm({ ...foodForm, name: packagedInput });
                  setIsNewFoodOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Bu Ürünü Özel Olarak Kataloğa Ekle</span>
              </button>
            </div>
          )}

          {/* Sonuç Listesi */}
          {packagedResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packagedResults.map((product, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      {product.brand && (
                        <span className="text-[11px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                          {product.brand}
                        </span>
                      )}
                      <h4 className="font-bold text-slate-900 text-base mt-1">{product.name}</h4>
                      {product.barcode && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          Barkod: {product.barcode}
                        </p>
                      )}
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
                      <div className="font-bold text-emerald-600">{product.proteinG}g</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Karb</div>
                      <div className="font-bold text-amber-600">{product.carbsG}g</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Yağ</div>
                      <div className="font-bold text-purple-600">{product.fatG}g</div>
                    </div>
                  </div>

                  {/* Lif / Tuz veya Uyarılar */}
                  {product.uncertainties && product.uncertainties.length > 0 && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg">
                      {product.uncertainties.join(" • ")}
                    </div>
                  )}

                  {/* Eylem Butonları */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 italic">Kaynak: Open Food Facts</span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLogProductAsMeal(product, 100)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                      >
                        +100g Öğün Ekle
                      </button>
                      <button
                        onClick={() => handleImportToCatalog(product)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                      >
                        <Download className="w-3 h-3" />
                        <span>Kataloğa Kaydet</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BESİNLER SEKMESİ */}
      {activeTab === "foods" && (
        <div className="space-y-4">
          {/* Arama ve Filtreleme */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Besin ara (örn: tavuk, bulgur, yumurta)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? "bg-slate-900 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {cat === "all" ? "Tümü" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Besin Tablosu / Kartları */}
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
          {!loading && !loadError && filteredFoods.length === 0 && (
            <p className="text-sm text-slate-500">Aramanıza uyan besin bulunamadı.</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredFoods.map((f) => (
              <div
                key={f.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{f.name}</h4>
                    <span className="text-[10px] text-slate-400">{f.category}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      f.confidence === "Yüksek"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
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
                    <div className="font-bold text-emerald-600">{f.proteinG}g</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Karb</div>
                    <div className="font-bold text-amber-600">{f.carbsG}g</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Yağ</div>
                    <div className="font-bold text-purple-600">{f.fatG}g</div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                  <span>100g bazında</span>
                  <span>{f.source}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TARİFLER SEKMESİ */}
      {activeTab === "recipes" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipes.map((r) => {
            let totalCals = 0;
            let totalP = 0;
            let totalC = 0;
            let totalF = 0;

            r.ingredients.forEach((ing: any) => {
              const factor = ing.grams / 100;
              totalCals += ing.foodItem.calories * factor;
              totalP += ing.foodItem.proteinG * factor;
              totalC += ing.foodItem.carbsG * factor;
              totalF += ing.foodItem.fatG * factor;
            });

            return (
              <div
                key={r.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{r.name}</h3>
                    <p className="text-xs text-slate-500">
                      Hazırlama: {r.prepMinutes} dk • {r.servings} porsiyon
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 text-brand-700 font-bold rounded-lg text-xs">
                    <Flame className="w-3.5 h-3.5" />
                    <span>{Math.round(totalCals)} kcal</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-xl text-xs">
                  <div>
                    <div className="text-slate-400 text-[10px]">Protein</div>
                    <div className="font-bold text-emerald-600">{Math.round(totalP)}g</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Karbonhidrat</div>
                    <div className="font-bold text-amber-600">{Math.round(totalC)}g</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Yağ</div>
                    <div className="font-bold text-purple-600">{Math.round(totalF)}g</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-700">Malzemeler:</div>
                  <div className="text-xs text-slate-600 space-y-1">
                    {r.ingredients.map((ing: any) => (
                      <div key={ing.id} className="flex justify-between">
                        <span>• {ing.foodItem.name}</span>
                        <span className="font-medium">{ing.grams}g</span>
                      </div>
                    ))}
                  </div>
                </div>

                {r.instructions && (
                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 italic">
                    {r.instructions}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* YENİ BESİN MODALI */}
      <Modal open={isNewFoodOpen} onClose={() => setIsNewFoodOpen(false)} title="Yeni Besin Ekle" description="100g bazında doğru değerleri girin; tüm hesaplamalar bu değerlere dayanır.">
            <form onSubmit={handleCreateFood} className="space-y-3.5">
              <div>
                <label htmlFor="food-field-1" className="block text-xs font-semibold text-slate-700 mb-1">
                  Besin Adı
                </label>
                <input id="food-field-1"
                  type="text"
                  required
                  placeholder="örn: Hindi Göğsü, Tam Buğday Ekmeği"
                  value={foodForm.name}
                  onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label htmlFor="food-field-2" className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori
                </label>
                <select id="food-field-2"
                  value={foodForm.category}
                  onChange={(e) =>
                    setFoodForm({ ...foodForm, category: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  {categories.filter((c) => c !== "all").map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="food-field-3" className="block text-xs font-semibold text-slate-700 mb-1">
                    Kalori (kcal/100g)
                  </label>
                  <input id="food-field-3"
                    type="number"
                    required
                    value={foodForm.calories}
                    onChange={(e) =>
                      setFoodForm({
                        ...foodForm,
                        calories: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="food-field-4" className="block text-xs font-semibold text-slate-700 mb-1">
                    Protein (g/100g)
                  </label>
                  <input id="food-field-4"
                    type="number"
                    step="0.1"
                    required
                    value={foodForm.proteinG}
                    onChange={(e) =>
                      setFoodForm({
                        ...foodForm,
                        proteinG: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="food-field-5" className="block text-xs font-semibold text-slate-700 mb-1">
                    Karbonhidrat (g/100g)
                  </label>
                  <input id="food-field-5"
                    type="number"
                    step="0.1"
                    required
                    value={foodForm.carbsG}
                    onChange={(e) =>
                      setFoodForm({
                        ...foodForm,
                        carbsG: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="food-field-6" className="block text-xs font-semibold text-slate-700 mb-1">
                    Yağ (g/100g)
                  </label>
                  <input id="food-field-6"
                    type="number"
                    step="0.1"
                    required
                    value={foodForm.fatG}
                    onChange={(e) =>
                      setFoodForm({
                        ...foodForm,
                        fatG: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewFoodOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
                >
                  Kaydet
                </button>
              </div>
            </form>
      </Modal>

      {/* YENİ TARİF MODALI */}
      <Modal open={isNewRecipeOpen} onClose={() => setIsNewRecipeOpen(false)} title="Yeni Tarif Oluştur" description="Malzemeleri seçin ve gramaj girin; toplam makrolar otomatik hesaplanacaktır." widthClass="max-w-lg">
            <form onSubmit={handleCreateRecipe} className="space-y-4">
              <div>
                <label htmlFor="food-field-7" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tarif Adı
                </label>
                <input id="food-field-7"
                  type="text"
                  required
                  placeholder="örn: Fırında Somon & Patates"
                  value={recipeForm.name}
                  onChange={(e) =>
                    setRecipeForm({ ...recipeForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="food-field-8" className="block text-xs font-semibold text-slate-700 mb-1">
                    Hazırlama Süresi (dk)
                  </label>
                  <input id="food-field-8"
                    type="number"
                    value={recipeForm.prepMinutes}
                    onChange={(e) =>
                      setRecipeForm({
                        ...recipeForm,
                        prepMinutes: parseInt(e.target.value) || 15,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="food-field-9" className="block text-xs font-semibold text-slate-700 mb-1">
                    Porsiyon Adedi
                  </label>
                  <input id="food-field-9"
                    type="number"
                    value={recipeForm.servings}
                    onChange={(e) =>
                      setRecipeForm({
                        ...recipeForm,
                        servings: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="food-field-10" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tarif Notları / Pişirme Talimatı
                </label>
                <textarea id="food-field-10"
                  rows={2}
                  value={recipeForm.instructions}
                  onChange={(e) =>
                    setRecipeForm({ ...recipeForm, instructions: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              {/* Malzeme Seçimi */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Malzemeler & Gramajlar
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setRecipeForm({
                        ...recipeForm,
                        ingredients: [
                          ...recipeForm.ingredients,
                          { foodItemId: "", grams: 100 },
                        ],
                      })
                    }
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Malzeme Ekle
                  </button>
                </div>

                <div className="space-y-2">
                  {recipeForm.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={ing.foodItemId}
                        onChange={(e) => {
                          const updated = [...recipeForm.ingredients];
                          updated[idx].foodItemId = e.target.value;
                          setRecipeForm({ ...recipeForm, ingredients: updated });
                        }}
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        required
                      >
                        <option value="">Besin seçin</option>
                        {foods.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={ing.grams}
                        onChange={(e) => {
                          const updated = [...recipeForm.ingredients];
                          updated[idx].grams = parseFloat(e.target.value) || 0;
                          setRecipeForm({ ...recipeForm, ingredients: updated });
                        }}
                        className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        placeholder="g"
                        required
                      />
                      <span className="text-xs text-slate-400">g</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewRecipeOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700"
                >
                  Tarifi Kaydet
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
}
