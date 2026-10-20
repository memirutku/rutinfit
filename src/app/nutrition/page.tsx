"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Utensils,
  ShoppingCart,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Package,
  RefreshCw,
} from "lucide-react";
import { getLocalDateString } from "@/lib/date-utils";
import { formatAmount } from "@/lib/format";

export default function NutritionPage() {
  const [activeTab, setActiveTab] = useState<"plan" | "shopping" | "prep">("plan");
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [mealPlans, setMealPlans] = useState<any[]>([]);
  const [shoppingData, setShoppingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [portionMultipliers, setPortionMultipliers] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, shopRes] = await Promise.all([
        fetch(`/api/meal-plans?date=${selectedDate}`),
        fetch(`/api/shopping?weekStart=${selectedDate}`),
      ]);
      const planJson = planRes.ok ? await planRes.json() : [];
      let shopJson = shopRes.ok ? await shopRes.json() : null;
      // Bu hafta için henüz liste oluşturulmadıysa plandan bir kez kur (GET salt-okunurdur).
      if (shopJson && !shopJson.generated) {
        const genRes = await fetch("/api/shopping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart: selectedDate, deductPantry: true }),
        });
        if (genRes.ok) shopJson = await genRes.json();
      }
      setMealPlans(Array.isArray(planJson) ? planJson : []);
      setShoppingData(shopJson);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleToggleShoppingItem(id: string, currentChecked: boolean) {
    try {
      const res = await fetch("/api/shopping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, checked: !currentChecked }),
      });
      if (!res.ok) throw new Error("Alışveriş kalemi güncellenemedi");
      // Yerel state güncelle
      setShoppingData((prev: any) => {
        if (!prev) return prev;
        const updatedItems = prev.items.map((i: any) =>
          i.id === id ? { ...i, checked: !currentChecked } : i
        );
        const grouped: Record<string, any[]> = {};
        for (const it of updatedItems) {
          if (!grouped[it.category]) grouped[it.category] = [];
          grouped[it.category].push(it);
        }
        return { ...prev, items: updatedItems, grouped };
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleLogPlannedMealAsEaten(meal: any, multiplier = 1) {
    if (!meal.recipeId || !meal.calculatedMacros) {
      setActionMessage("Bu öğüne bağlı bir tarif yok. Ana Panel'deki Hızlı Öğün ile kaydedebilirsiniz.");
      setTimeout(() => setActionMessage(null), 4000);
      return;
    }
    try {
      // Gösterilen değerle kaydedilen değer aynı formülden gelir: planlanan porsiyon × çarpan.
      const scaledCalories = Math.round(meal.calculatedMacros.calories * multiplier);
      const res = await fetch("/api/food-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          time: new Date().toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          mealType: meal.mealType,
          recipeId: meal.recipeId,
          name: meal.recipe?.name || meal.customName || "Planlanan Öğün",
          servings: (meal.servings || 1) * multiplier,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Öğün kaydedilemedi");
      }
      setActionMessage(
        `"${meal.recipe?.name || 'Öğün'}" (${multiplier}x porsiyon - ${scaledCalories} kcal) günlüğe kaydedildi! ✓`
      );
      setTimeout(() => setActionMessage(null), 3000);
    } catch (e: any) {
      setActionMessage(`Kaydedilemedi: ${e?.message || "bilinmeyen hata"}`);
      setTimeout(() => setActionMessage(null), 4000);
    }
  }

  async function handleRefreshShoppingListWithPantry() {
    setLoading(true);
    try {
      const res = await fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: selectedDate, deductPantry: true }),
      });
      if (res.ok) {
        loadData();
        setActionMessage("Alışveriş listesi kiler stokları düşülerek güncellendi! ✓");
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const currentPlan = mealPlans[0] || null;

  // Günlük öğün planı yoksa varsayılan dağılım rehberi
  const defaultMealTemplates = [
    {
      type: "breakfast",
      title: "Kahvaltı",
      targetKcal: 430,
      targetProtein: 35,
      example: "Yulaflı Lorlu Fit Omlet & Çay",
      time: "07:00 - 07:30",
    },
    {
      type: "lunch",
      title: "Öğle Yemeği",
      targetKcal: 620,
      targetProtein: 45,
      example: "Izgara Tavuklu Bulgur Pilavı & Yoğurt",
      time: "12:30 - 13:00",
    },
    {
      type: "workSnack",
      title: "İş Çıkışı Ara Öğünü",
      targetKcal: 280,
      targetProtein: 20,
      example: "Muzlu Yoğurt & Lor Kasesi (İş yerinde pratik)",
      time: "17:00 (İşten çıkmadan önce)",
    },
    {
      type: "dinner",
      title: "Akşam Yemeği",
      targetKcal: 750,
      targetProtein: 65,
      example: "Fırın Tavuk Göğsü, Fırın Patates & Yoğurt",
      time: "20:30 (Antrenman sonrası)",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Üst Başlık ve Sekmeler */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Beslenme & Yemek Planı 🥗
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Hedef: 2.080 kcal · 165g Protein · 220g Karb · 60g Yağ
          </p>
        </div>

        {/* Sekme Butonları */}
        <div className="flex p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab("plan")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "plan"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Yemek Planı</span>
          </button>
          <button
            onClick={() => setActiveTab("shopping")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "shopping"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Alışveriş Listesi</span>
          </button>
          <button
            onClick={() => setActiveTab("prep")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "prep"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Meal-Prep Rehberi</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium">
          {actionMessage}
        </div>
      )}

      {/* 1. SEKME: YEMEK PLANI */}
      {activeTab === "plan" && (
        <div className="space-y-6">
          {/* Tarih Seçici */}
          <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-sm font-semibold text-slate-700">Tarih:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={() => setSelectedDate(getLocalDateString())}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold"
            >
              Bugüne Git
            </button>
          </div>

          {/* 4 Temel Öğün Kartları */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {defaultMealTemplates.map((template) => {
              // Veritabanında planlanan öğün var mı
              const planned = currentPlan?.meals?.find(
                (m: any) => m.mealType === template.type
              );

              return (
                <div
                  key={template.type}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {template.title}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {template.time}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {planned?.recipe?.name || template.example}
                    </h3>

                    {/* Porsiyon Çarpanı Seçici (Tally UX esintisi) */}
                    {(() => {
                      const mult = portionMultipliers[template.type] || 1;
                      const baseCal = planned?.calculatedMacros?.calories || template.targetKcal;
                      const basePro = planned?.calculatedMacros?.proteinG || template.targetProtein;
                      const baseCarb = planned?.calculatedMacros?.carbsG || 40;
                      const baseFat = planned?.calculatedMacros?.fatG || 10;

                      const cal = Math.round(baseCal * mult);
                      const pro = Math.round(basePro * mult * 10) / 10;
                      const carb = Math.round(baseCarb * mult * 10) / 10;
                      const fat = Math.round(baseFat * mult * 10) / 10;

                      return (
                        <>
                          <div className="flex items-center gap-1.5 mb-2.5 bg-slate-50 p-1 rounded-lg w-fit">
                            <span className="text-[10px] text-slate-400 font-semibold px-1">Porsiyon:</span>
                            {[0.5, 1.0, 1.5].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() =>
                                  setPortionMultipliers((prev) => ({ ...prev, [template.type]: m }))
                                }
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                                  mult === m
                                    ? "bg-slate-900 text-white shadow-2xs"
                                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {m}x
                              </button>
                            ))}
                          </div>

                          {/* Makro Hedef ve Gerçekleşen Rozetleri */}
                          <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold flex items-center gap-1">
                              <Flame className="w-3.5 h-3.5" />
                              {cal} kcal
                            </span>
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                              P: {pro}g
                            </span>
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium">
                              K: {carb}g
                            </span>
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium">
                              Y: {fat}g
                            </span>
                          </div>

                          {/* Malzeme listesi (tarif varsa) */}
                          {planned?.recipe?.ingredients && (
                            <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100 text-xs">
                              <p className="font-semibold text-slate-700 mb-1.5">
                                Malzemeler ({Math.round(planned.servings * mult * 10) / 10} porsiyon):
                              </p>
                              <ul className="space-y-1 text-slate-600">
                                {planned.recipe.ingredients.map((ing: any) => (
                                  <li key={ing.id} className="flex justify-between">
                                    <span>• {ing.foodItem.name}</span>
                                    <span className="font-medium text-slate-900">
                                      {Math.round(ing.grams * planned.servings * mult)} g
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              onClick={() =>
                                handleLogPlannedMealAsEaten(
                                  planned || {
                                    mealType: template.type,
                                    recipe: { name: template.example },
                                    calculatedMacros: {
                                      calories: template.targetKcal,
                                      proteinG: template.targetProtein,
                                      carbsG: 40,
                                      fatG: 10,
                                    },
                                  },
                                  mult
                                )
                              }
                              className="flex-1 py-2 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors text-center shadow-2xs"
                            >
                              {mult !== 1 ? `${mult}x Porsiyon Olarak Kaydet` : "Yedim Olarak Kaydet"}
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. SEKME: HAFTALIK ALIŞVERİŞ LİSTESİ */}
      {activeTab === "shopping" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Haftalık Alışveriş Listesi 🛒
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Haftalık yemek planındaki tarif malzemeleri toplanıp kategori bazlı tekilleştirilmiştir.
              </p>
            </div>
            <span className="text-xs bg-brand-50 text-brand-700 font-semibold px-3 py-1.5 rounded-full border border-brand-200">
              Hafta: {shoppingData?.weekStart ?? selectedDate}
            </span>
          </div>

          {/* Kiler Envanteri Özeti ve Yenileme Butonu (Pantry Host entegrasyonu) */}
          <div className="p-3.5 bg-brand-50/70 border border-brand-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-brand-900 font-medium">
              <Package className="w-4 h-4 text-brand-600 shrink-0" />
              <span>
                {shoppingData?.pantrySummary ||
                  "Evdeki kiler stoklarınız bu alışveriş listesinden otomatik düşülür."}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/pantry"
                className="font-bold underline text-brand-700 hover:text-brand-900"
              >
                Kilerime Git →
              </Link>
              <button
                type="button"
                onClick={handleRefreshShoppingListWithPantry}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-brand-200 hover:bg-brand-50 text-brand-700 rounded-lg font-bold shadow-2xs transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Kileri Düşerek Yenile</span>
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Yükleniyor...</p>
          ) : shoppingData?.grouped && Object.keys(shoppingData.grouped).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(shoppingData.grouped).map(([category, items]: [string, any]) => (
                <div
                  key={category}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200/80"
                >
                  <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-600" />
                    {category}
                  </h4>
                  <ul className="space-y-2">
                    {items.map((item: any) => (
                      <li
                        key={item.id}
                        onClick={() => handleToggleShoppingItem(item.id, item.checked)}
                        role="checkbox"
                        aria-checked={item.checked}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            handleToggleShoppingItem(item.id, item.checked);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          item.checked
                            ? "bg-slate-100/70 text-slate-400 line-through"
                            : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-100 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {item.checked ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                          <span className="text-sm font-medium">{item.name}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-600">
                          {formatAmount(item.amount, item.unit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              Bu hafta için henüz malzeme listesi bulunmuyor.
            </div>
          )}
        </div>
      )}

      {/* 3. SEKME: PAZAR GÜNÜ MEAL-PREP REHBERİ */}
      {activeTab === "prep" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Pazar Günü Meal-Prep (Ön Hazırlık) Rehberi 🍱
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hafta içi iş çıkışı yorgunluğunu azaltmak için 1 saatlik pazar ön hazırlığı hayat kurtarır.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl">
              <h4 className="font-bold text-blue-900 text-sm mb-2">
                1. Tavuk Göğsü Toplu Pişirme
              </h4>
              <p className="text-xs text-blue-800 leading-relaxed mb-2">
                Pazar günü 800g–1kg tavuk göğsünü zeytinyağı, pul biber ve kekikle harmanlayıp fırında 200°C'de 25 dk pişirin.
              </p>
              <div className="text-xs text-blue-700 bg-white/70 p-2.5 rounded-lg border border-blue-100">
                <strong>Saklama:</strong> Cam saklama kabında buzdolabında 3–4 gün tazeliğini korur.
              </div>
            </div>

            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <h4 className="font-bold text-emerald-900 text-sm mb-2">
                2. Bulgur / Pirinç Haşlama
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed mb-2">
                Haftalık 300g pilavlık bulguru önceden pişirip porsiyonlayın. Isıtıldığında kurumasını önlemek için üzerine 1 yemek kaşığı su ekleyerek mikrodalgaya atın.
              </p>
              <div className="text-xs text-emerald-700 bg-white/70 p-2.5 rounded-lg border border-emerald-100">
                <strong>Saklama:</strong> Hava geçirmez kapta buzdolabında 4–5 gün.
              </div>
            </div>

            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl">
              <h4 className="font-bold text-amber-900 text-sm mb-2">
                3. İş Yeri Ara Öğün Kapları
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed mb-2">
                Muz, yoğurt ve lor peynirini iş yeri buzdolabına pazartesi günü haftalık stoklayabilir veya her akşam 2 dakikada hazırlayıp çantaya atabilirsiniz.
              </p>
              <div className="text-xs text-amber-700 bg-white/70 p-2.5 rounded-lg border border-amber-100">
                <strong>İpucu:</strong> Saat 17:00'de yenecek bu ara öğün, 19:30 eve varışta enerjinizi yüksek tutar.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <h4 className="font-bold text-slate-800 text-sm mb-2">
                4. Gıda Güvenliği Hatırlatması
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pişirilmiş yemekleri oda sıcaklığında 2 saatten fazla bekletmeyin; ılındıktan hemen sonra buzdolabına kaldırın. Kokusu veya görüntüsü değişen gıdaları tüketmeyin.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
