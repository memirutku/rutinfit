"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RECENT_FOODS_KEY, parseRecentFoods, pushRecentFood, type RecentFood } from "@/lib/recent-foods";
import { buildRestorePayload } from "@/lib/food-log-restore";
import {
  Flame,
  CheckCircle2,
  Circle,
  Plus,
  Dumbbell,
  Clock,
  Moon,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Utensils,
  ExternalLink,
  Trash2,
  Coffee,
  Sun,
} from "lucide-react";
import { useToday } from "@/hooks/useToday";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { DEFAULT_TARGETS } from "@/lib/constants";
import type { MealType } from "@/lib/schemas/enums";
import { UndoToast, type UndoToastData } from "@/components/dashboard/UndoToast";
import { QuickAddModal, type QuickAddValues } from "@/components/dashboard/QuickAddModal";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [foodData, setFoodData] = useState<any>(null);
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [progressData, setProgressData] = useState<any>(null);
  const [quickWeight, setQuickWeight] = useState<string>("");
  const [quickEnergy, setQuickEnergy] = useState<number>(3);
  const [quickSleep, setQuickSleep] = useState<string>("7");
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Hızlı yemek ekleme modalı
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [foodsList, setFoodsList] = useState<any[]>([]);
  const [isLoadingFoods, setIsLoadingFoods] = useState(false);
  const [quickAddMealType, setQuickAddMealType] = useState<MealType>("lunch");
  const [actionError, setActionError] = useState<string | null>(null);

  // Son kullanılan besinler ve Geri Alma (Undo) state'i
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const [undo, setUndo] = useState<{
    toast: UndoToastData;
    logId?: string;
    payload?: ReturnType<typeof buildRestorePayload>;
  } | null>(null);

  // Gece yarısını geçen açık pencerede de doğru gün (kayıtlar yanlış güne düşmez)
  const todayStr = useToday();
  const hasLoadedOnce = useRef(false);

  function getRhythmStep(homeTime: string = "19:30") {
    const currentHour = new Date().getHours();
    if (currentHour < 11) {
      return {
        title: "Sabah Rutini & Hidrasyon",
        time: "07:00 - 11:00",
        description: "Güne 500ml su ile başla, tartılmanı kaydet ve günlük 5g kreatinini almayı unutma.",
        icon: Sun,
        badge: "Güne Başlangıç",
        color: "text-amber-600 bg-amber-50 border-amber-200",
        actionText: progressData?.today?.creatineTaken ? "Kreatin Alındı ✓" : "Kreatin İşaretle",
        actionFn: handleToggleCreatine,
      };
    } else if (currentHour < 16) {
      return {
        title: "Öğle Beslenmesi & Odak",
        time: "12:00 - 15:30",
        description: "Yüksek proteinli öğle öğününü kaydet, hidrasyonu sürdür ve enerjini dengede tut.",
        icon: Coffee,
        badge: "Öğle Zamanı",
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        actionText: "Öğle Yemeği Ekle",
        actionFn: () => handleOpenQuickAdd("lunch"),
      };
    } else if (currentHour < 19) {
      return {
        title: "İş Çıkışı & Antrenman Hazırlığı",
        time: `17:00 - ${homeTime}`,
        description: `İş çıkışı hafif karbonhidrat desteği ile antrenman için enerji topla. Eve varış hedefi: ${homeTime}.`,
        icon: Dumbbell,
        badge: "İş Çıkışı",
        color: "text-indigo-700 bg-indigo-50 border-indigo-200",
        actionText: "Ara Öğün Ekle",
        actionFn: () => handleOpenQuickAdd("workSnack"),
      };
    } else if (currentHour < 22) {
      return {
        title: "Toparlanma & Akşam Yemeği",
        time: `${homeTime} - 21:30`,
        description: "Antrenman sonrası kas onarımı için protein ağırlıklı akşam yemeğini ye ve günün kaydını tamamla.",
        icon: Utensils,
        badge: "Akşam Dinlenmesi",
        color: "text-orange-700 bg-orange-50 border-orange-200",
        actionText: "Akşam Yemeği Ekle",
        actionFn: () => handleOpenQuickAdd("dinner"),
      };
    } else {
      return {
        title: "Gece Kapanışı & Kaliteli Uyku",
        time: "22:00 - 07:00",
        description: "Mavi ışık maruziyetini azalt, yatak odasını serinlet ve 7.5 saatlik dinlenmeye geç.",
        icon: Moon,
        badge: "Gece Rutini",
        color: "text-blue-700 bg-blue-50 border-blue-200",
        actionText: "Uyku & İyilik Halini Kaydet",
        actionFn: () => {
          const el = document.getElementById("quick-wellbeing-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        },
      };
    }
  }

  function showError(e: unknown, fallback: string) {
    setActionError(errorMessage(e, fallback));
    setTimeout(() => setActionError(null), 5000);
  }

  // İlk yüklemede tam ekran yükleniyor; sonraki yenilemeler arka planda (titreme, kaydırma kaybı yok).
  const loadAllData = useCallback(async () => {
    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const [profRes, foodRes, workoutRes, progRes] =
        await Promise.all([
          fetch("/api/profile"),
          fetch(`/api/food-logs?date=${todayStr}`),
          fetch(`/api/workouts?date=${todayStr}`),
          fetch("/api/progress"),
        ]);

      const profJson = profRes.ok ? await profRes.json() : null;
      const foodJson = foodRes.ok ? await foodRes.json() : null;
      const workoutJson = workoutRes.ok ? await workoutRes.json() : null;
      const progJson = progRes.ok ? await progRes.json() : null;

      setProfile(profJson);
      setFoodData(foodJson);
      setWorkoutData(workoutJson);
      setProgressData(progJson);

      if (progJson?.today?.weightKg) {
        setQuickWeight(String(progJson.today.weightKg));
      }
      if (progJson?.today?.energy1to5) {
        setQuickEnergy(progJson.today.energy1to5);
      }
      if (progJson?.today?.sleepMinutes) {
        setQuickSleep(String(progJson.today.sleepMinutes / 60));
      }
    } catch (e) {
      console.error("Dashboard veri yükleme hatası:", e);
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    try {
      setRecentFoods(parseRecentFoods(localStorage.getItem(RECENT_FOODS_KEY)));
    } catch {
      // ignore
    }
  }, []);

  async function handleToggleCreatine() {
    if (!progressData) return;
    const nextState = !progressData.today.creatineTaken;
    try {
      await apiFetch("/api/progress", {
        method: "POST",
        json: { date: todayStr, creatineTaken: nextState, creatineDoseGrams: 5.0 },
      });
      setProgressData((prev: any) => ({
        ...prev,
        today: { ...prev.today, creatineTaken: nextState },
      }));
    } catch (e) {
      showError(e, "Kreatin kaydı güncellenemedi.");
    }
  }

  async function handleSaveQuickWellbeing(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProgress(true);
    setSaveMessage(null);
    try {
      const weight = quickWeight ? parseFloat(quickWeight.replace(",", ".")) : NaN;
      const sleepHours = quickSleep ? parseFloat(quickSleep.replace(",", ".")) : NaN;
      await apiFetch("/api/progress", {
        method: "POST",
        json: {
          date: todayStr,
          weightKg: Number.isFinite(weight) && weight > 0 ? weight : undefined,
          energy1to5: quickEnergy,
          sleepMinutes: Number.isFinite(sleepHours) ? Math.round(sleepHours * 60) : 420,
        },
      });
      setSaveMessage("Kayıt güncellendi ✓");
      setTimeout(() => setSaveMessage(null), 3000);
      loadAllData();
    } catch (e) {
      showError(e, "Kayıt güncellenemedi.");
    } finally {
      setIsSavingProgress(false);
    }
  }

  async function handleOpenQuickAdd(preferredMealType?: string) {
    if (preferredMealType) setQuickAddMealType(preferredMealType as MealType);
    setIsQuickAddOpen(true);
    if (foodsList.length === 0) {
      setIsLoadingFoods(true);
      try {
        setFoodsList(await apiFetch<any[]>("/api/foods?limit=50"));
      } catch (err) {
        showError(err, "Besin listesi yüklenemedi.");
      } finally {
        setIsLoadingFoods(false);
      }
    }
  }

  /** Makrolar sunucuda katalogdan hesaplanır; hata modalda gösterilir. */
  async function handleQuickAddSubmit(values: QuickAddValues) {
    const created = await apiFetch<any>("/api/food-logs", {
      method: "POST",
      json: {
        date: todayStr,
        time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        mealType: values.mealType,
        foodItemId: values.foodItemId,
        name: values.name,
        grams: values.grams,
      },
    });

    const updatedRecent = pushRecentFood(recentFoods, {
      id: values.foodItemId,
      name: values.name,
      defaultGrams: values.grams,
    });
    setRecentFoods(updatedRecent);
    try {
      localStorage.setItem(RECENT_FOODS_KEY, JSON.stringify(updatedRecent));
    } catch {
      // ignore
    }

    setUndo({ toast: { key: `add-${created.id}`, name: created.name, action: "added" }, logId: created.id });
    setIsQuickAddOpen(false);
    loadAllData();
  }

  async function handleUndo() {
    if (!undo) return;
    try {
      if (undo.toast.action === "added" && undo.logId) {
        await apiFetch(`/api/food-logs?id=${encodeURIComponent(undo.logId)}`, { method: "DELETE" });
      } else if (undo.toast.action === "deleted" && undo.payload) {
        await apiFetch("/api/food-logs", { method: "POST", json: undo.payload });
      }
      setUndo(null);
      loadAllData();
    } catch (e) {
      showError(e, "Geri alma başarısız oldu.");
    }
  }

  async function handleDeleteFoodLog(log: any) {
    try {
      await apiFetch(`/api/food-logs?id=${encodeURIComponent(log.id)}`, { method: "DELETE" });
      setUndo({
        toast: { key: `del-${log.id}`, name: log.name, action: "deleted" },
        payload: buildRestorePayload(log),
      });
      loadAllData();
    } catch (e) {
      showError(e, "Öğün silinemedi.");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">RutinFit verileriniz yükleniyor...</p>
      </div>
    );
  }

  const summary = foodData?.summary;
  const targets = foodData?.targets || DEFAULT_TARGETS;

  // Haftanın gününe göre günün şablonunu belirle (1: Pazartesi ... 7: Pazar)
  const currentDayOfWeek = new Date().getDay() || 7;
  const todayTemplate = workoutData?.templates?.find(
    (t: any) => t.dayOfWeek === currentDayOfWeek
  );
  const isWorkoutCompleted = workoutData?.sessions?.some(
    (s: any) => s.date === todayStr && s.completed
  );

  return (
    <div className="space-y-6">
      {/* Üst Karşılama ve Hızlı Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Merhaba, Hoş Geldin 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Bugün:{" "}
            {new Date().toLocaleDateString("tr-TR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            · Eve tahmini varış: {profile?.workdayHomeTime || "19:30"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/coach"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-50 text-brand-700 text-sm font-semibold hover:bg-brand-100 transition-colors border border-brand-200"
          >
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span>AI Koçuna Danış</span>
          </Link>
          <button
            onClick={() => handleOpenQuickAdd()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Hızlı Öğün Ekle</span>
          </button>
        </div>
      </div>

      {/* Sakin Üst Sınır Uyarısı */}
      {summary?.ceilingAlert?.message && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            summary.ceilingAlert.isExceeded
              ? "bg-amber-50/80 border-amber-200 text-amber-900"
              : "bg-blue-50/80 border-blue-200 text-blue-900"
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">
              {summary.ceilingAlert.isExceeded
                ? "Günlük Kalori Üst Sınırı"
                : "Hedef Hatırlatması"}
            </p>
            <p className="mt-0.5 opacity-90">{summary.ceilingAlert.message}</p>
          </div>
        </div>
      )}

      {/* Günün Sıradaki Adımı / Ritim Çizelgesi */}
      {(() => {
        const step = getRhythmStep(profile?.workdayHomeTime);
        const Icon = step.icon;
        return (
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
                    Sıradaki Adım · {step.time}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-medium">
                    {step.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  {step.description}
                </p>
              </div>
            </div>
            <button
              onClick={step.actionFn}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition-colors shrink-0 shadow-sm"
            >
              <span>{step.actionText}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })()}

      {/* Ana Metrikler: Kalori & Makrolar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kalori Özeti Kartı */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Bugünkü Kalori
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>

          <div className="my-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900">
                {summary?.consumedCalories || 0}
              </span>
              <span className="text-slate-400 font-medium text-lg">
                / {targets.calorieTarget} kcal
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Kalan:{" "}
              <span className="font-semibold text-slate-800">
                {summary?.remainingCalories ?? targets.calorieTarget} kcal
              </span>{" "}
              (Üst sınır: {targets.calorieCeiling} kcal)
            </p>
          </div>

          <div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  summary?.ceilingAlert?.isExceeded
                    ? "bg-amber-500"
                    : "bg-brand-600"
                }`}
                style={{
                  width: `${Math.min(100, summary?.progressPercent?.calories || 0)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1.5 font-medium">
              <span>%0</span>
              <span>Hedef: %100</span>
              <span>Tavan</span>
            </div>
          </div>
        </div>

        {/* Makro Dağılımı Kartı */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Makro Besin Dengesi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Enerji dengesi: Protein ve Karb (4 kcal/g), Yağ (9 kcal/g)
              </p>
            </div>
            <Link
              href="/nutrition"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              <span>Detaylı Plan</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {/* Protein Bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-slate-700">
                  Protein (Hedef: {targets.proteinTargetG}g)
                </span>
                <span className="font-bold text-slate-900">
                  {summary?.consumedProtein || 0}g / {targets.proteinTargetG}g{" "}
                  <span className="text-xs text-slate-400 font-normal">
                    (Kalan: {summary?.remainingProtein ?? targets.proteinTargetG}g)
                  </span>
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, summary?.progressPercent?.protein || 0)}%`,
                  }}
                />
              </div>
            </div>

            {/* Karbonhidrat Bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-slate-700">
                  Karbonhidrat (Hedef: {targets.carbTargetG}g)
                </span>
                <span className="font-bold text-slate-900">
                  {summary?.consumedCarbs || 0}g / {targets.carbTargetG}g{" "}
                  <span className="text-xs text-slate-400 font-normal">
                    (Kalan: {summary?.remainingCarbs ?? targets.carbTargetG}g)
                  </span>
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, summary?.progressPercent?.carbs || 0)}%`,
                  }}
                />
              </div>
            </div>

            {/* Yağ Bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-slate-700">
                  Sağlıklı Yağ (Hedef: {targets.fatTargetG}g)
                </span>
                <span className="font-bold text-slate-900">
                  {summary?.consumedFat || 0}g / {targets.fatTargetG}g{" "}
                  <span className="text-xs text-slate-400 font-normal">
                    (Kalan: {summary?.remainingFat ?? targets.fatTargetG}g)
                  </span>
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, summary?.progressPercent?.fat || 0)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* İkinci Sıra: Günün Antrenmanı & Kreatin / İyilik Hali */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Günün Antrenmanı Kartı */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Dumbbell className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  Günün Antrenmanı
                </span>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  isWorkoutCompleted
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {isWorkoutCompleted ? "Tamamlandı ✓" : "Bekliyor"}
              </span>
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-1">
              {todayTemplate ? todayTemplate.name : "Dinlenme & Toparlanma"}
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              {todayTemplate?.notes ||
                "Haftalık toparlanma ve hazırlık günü. İsteğe bağlı hafif yürüyüş."}
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mb-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Hedef: {todayTemplate?.targetDurationMinutes || 0} dk
              </span>
              <span>·</span>
              <span>İş Çıkışı: 19:40 Başlangıç</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <Link
              href="/workouts"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              <Dumbbell className="w-3.5 h-3.5" />
              <span>
                {isWorkoutCompleted
                  ? "Seansı Gör"
                  : "RutinFit'te Başla"}
              </span>
            </Link>
            <Link
              href="/opengym"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold hover:bg-brand-100 transition-colors"
            >
              <span>openGym</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            {!isWorkoutCompleted && (
              <Link
                href="/coach"
                className="px-2.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors text-center"
              >
                Hafiflet
              </Link>
            )}
          </div>
        </div>

        {/* Günlük Kreatin & İyilik Hali Hızlı Giriş */}
        <div id="quick-wellbeing-section" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                Günlük Ritim & Kreatin
              </span>
              <button
                type="button"
                onClick={handleToggleCreatine}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  progressData?.today?.creatineTaken
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {progressData?.today?.creatineTaken ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-400" />
                )}
                <span>5g Kreatin Alındı</span>
              </button>
            </div>

            <form onSubmit={handleSaveQuickWellbeing} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Sabah Kilosu */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Sabah Kilosu (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Örn: 112.0"
                    value={quickWeight}
                    onChange={(e) => setQuickWeight(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                  />
                </div>

                {/* Uyku Süresi */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Uyku (saat)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Örn: 7.5"
                    value={quickSleep}
                    onChange={(e) => setQuickSleep(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Enerji Seviyesi (1-5) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Günlük Enerji Seviyesi:{" "}
                  <span className="text-slate-900 font-bold">
                    {quickEnergy} / 5
                  </span>
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setQuickEnergy(level)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                        quickEnergy === level
                          ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="submit"
                  disabled={isSavingProgress}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {isSavingProgress ? "Kaydediliyor..." : "Kaydet"}
                </button>
                {saveMessage && (
                  <span className="text-xs text-emerald-600 font-medium">
                    {saveMessage}
                  </span>
                )}
              </div>
            </form>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
            <p>
              💡 Dinlenme günleri dahil günlük 5g kreatin kullanımı kas doygunluğunu
              korur.
            </p>
          </div>
        </div>
      </div>

      {/* Bugün Kaydedilen Öğünler ve Hızlı Yönetim */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Bugün Kaydedilen Öğünler
              </h3>
              <p className="text-xs text-slate-500">
                Günün besin kayıtları · Yanlış girişleri silebilir ve anında geri alabilirsiniz.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenQuickAdd()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Öğün Ekle</span>
          </button>
        </div>

        {(!foodData?.logs || foodData.logs.length === 0) ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Utensils className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-600">Henüz bugün için bir öğün kaydetmediniz</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Yukarıdaki &quot;Hızlı Öğün Ekle&quot; butonuna basarak veya son kullanılanlardan seçerek başlayın.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {foodData.logs.map((log: any) => {
              const mealLabel =
                log.mealType === "breakfast"
                  ? "Kahvaltı"
                  : log.mealType === "lunch"
                  ? "Öğle Yemeği"
                  : log.mealType === "workSnack"
                  ? "İş Çıkışı"
                  : log.mealType === "dinner"
                  ? "Akşam Yemeği"
                  : "Ara Öğün";

              return (
                <div
                  key={log.id}
                  className="py-3 flex items-center justify-between gap-3 group hover:bg-slate-50/50 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                      {mealLabel}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {log.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {log.grams}g · {log.caloriesSnapshot} kcal · P: {log.proteinSnapshot}g · K: {log.carbsSnapshot}g · Y: {log.fatSnapshot}g
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDeleteFoodLog(log)}
                      title="Öğünü Sil (Geri alınabilir)"
                      aria-label={`${log.name} öğününü sil`}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hızlı Öğün Ekleme Modalı */}
      <QuickAddModal
        open={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        foods={foodsList}
        isLoadingFoods={isLoadingFoods}
        recentFoods={recentFoods}
        initialMealType={quickAddMealType}
        onSubmit={handleQuickAddSubmit}
      />

      {/* Geri Alma (Undo) Bildirimi */}
      <UndoToast toast={undo?.toast ?? null} onUndo={handleUndo} onDismiss={() => setUndo(null)} />

      {actionError && (
        <div
          role="alert"
          className="fixed bottom-6 left-6 z-50 max-w-sm bg-rose-600 text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold"
        >
          {actionError}
        </div>
      )}
    </div>
  );
}
