"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Flame,
  CheckCircle2,
  Circle,
  Plus,
  Dumbbell,
  Clock,
  BatteryMedium,
  Moon,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Utensils,
  ExternalLink,
  RotateCcw,
  Trash2,
  Coffee,
  Sun,
  X,
  Compass,
} from "lucide-react";
import { getLocalDateString } from "@/lib/date-utils";

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
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [selectedMealType, setSelectedMealType] = useState("lunch");
  const [quickGrams, setQuickGrams] = useState("100");

  // Son kullanılan besinler ve Geri Alma (Undo) state'i
  const [recentFoods, setRecentFoods] = useState<{ id: string; name: string; defaultGrams: number }[]>([]);
  const [undoToast, setUndoToast] = useState<{
    id: string;
    name: string;
    calories: number;
    action: "added" | "deleted";
    payload?: any;
  } | null>(null);

  const todayStr = getLocalDateString();

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

  useEffect(() => {
    loadAllData();
    try {
      const saved = localStorage.getItem("rutinfit_recent_foods");
      if (saved) {
        setRecentFoods(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  async function loadAllData() {
    setLoading(true);
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
      if (progJson.today?.sleepMinutes) {
        setQuickSleep(String(progJson.today.sleepMinutes / 60));
      }
    } catch (e) {
      console.error("Dashboard veri yükleme hatası:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleCreatine() {
    if (!progressData) return;
    const nextState = !progressData.today.creatineTaken;
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          creatineTaken: nextState,
          creatineDoseGrams: 5.0,
        }),
      });
      setProgressData((prev: any) => ({
        ...prev,
        today: { ...prev.today, creatineTaken: nextState },
      }));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSaveQuickWellbeing(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProgress(true);
    setSaveMessage(null);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          weightKg: quickWeight ? parseFloat(quickWeight) : undefined,
          energy1to5: quickEnergy,
          sleepMinutes: quickSleep ? Math.round(parseFloat(quickSleep) * 60) : 420,
        }),
      });
      setSaveMessage("Kayıt güncellendi ✓");
      setTimeout(() => setSaveMessage(null), 3000);
      loadAllData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingProgress(false);
    }
  }

  async function handleOpenQuickAdd(preferredMealType?: string) {
    if (preferredMealType) {
      setSelectedMealType(preferredMealType);
    }
    setIsQuickAddOpen(true);
    if (foodsList.length === 0) {
      setIsLoadingFoods(true);
      try {
        const res = await fetch("/api/foods?limit=50");
        if (res.ok) {
          const data = await res.json();
          setFoodsList(data);
          if (data.length > 0 && !selectedFoodId) {
            setSelectedFoodId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Besin listesi yüklenemedi:", err);
      } finally {
        setIsLoadingFoods(false);
      }
    }
  }

  async function handleQuickAddFood(e: React.FormEvent) {
    e.preventDefault();
    const food = foodsList.find((f) => f.id === selectedFoodId);
    if (!food) return;

    const gramsNum = parseFloat(quickGrams) || 100;
    const ratio = gramsNum / food.basisGrams;

    const payload = {
      date: todayStr,
      time: new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      mealType: selectedMealType,
      foodItemId: food.id,
      name: food.name,
      grams: gramsNum,
      caloriesSnapshot: Math.round(food.calories * ratio),
      proteinSnapshot: Math.round(food.proteinG * ratio * 10) / 10,
      carbsSnapshot: Math.round(food.carbsG * ratio * 10) / 10,
      fatSnapshot: Math.round(food.fatG * ratio * 10) / 10,
    };

    try {
      const res = await fetch("/api/food-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        // Son kullanılanlara ekle
        const updatedRecent = [
          { id: food.id, name: food.name, defaultGrams: gramsNum },
          ...recentFoods.filter((rf) => rf.id !== food.id),
        ].slice(0, 5);
        setRecentFoods(updatedRecent);
        try {
          localStorage.setItem("rutinfit_recent_foods", JSON.stringify(updatedRecent));
        } catch {
          // ignore
        }

        // Undo toast göster
        setUndoToast({
          id: created.id,
          name: created.name,
          calories: created.caloriesSnapshot,
          action: "added",
        });
        setTimeout(() => {
          setUndoToast((curr) => (curr?.id === created.id ? null : curr));
        }, 7000);
      }

      setIsQuickAddOpen(false);
      loadAllData();
    } catch (e) {
      console.error("Yemek ekleme hatası:", e);
    }
  }

  async function handleUndo() {
    if (!undoToast) return;
    try {
      if (undoToast.action === "added") {
        await fetch(`/api/food-logs?id=${undoToast.id}`, { method: "DELETE" });
      } else if (undoToast.action === "deleted" && undoToast.payload) {
        await fetch("/api/food-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(undoToast.payload),
        });
      }
      setUndoToast(null);
      loadAllData();
    } catch (e) {
      console.error("Geri alma hatası:", e);
    }
  }

  async function handleDeleteFoodLog(log: any) {
    try {
      await fetch(`/api/food-logs?id=${log.id}`, { method: "DELETE" });
      setUndoToast({
        id: log.id,
        name: log.name,
        calories: log.caloriesSnapshot,
        action: "deleted",
        payload: {
          date: log.date,
          time: log.time,
          mealType: log.mealType,
          foodItemId: log.foodItemId,
          recipeId: log.recipeId,
          name: log.name,
          grams: log.grams,
          caloriesSnapshot: log.caloriesSnapshot,
          proteinSnapshot: log.proteinSnapshot,
          carbsSnapshot: log.carbsSnapshot,
          fatSnapshot: log.fatSnapshot,
        },
      });
      setTimeout(() => {
        setUndoToast((curr) => (curr?.id === log.id ? null : curr));
      }, 7000);
      loadAllData();
    } catch (e) {
      console.error("Öğün silme hatası:", e);
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
  const targets = foodData?.targets || {
    calorieTarget: 2080,
    calorieCeiling: 2100,
    proteinTargetG: 165,
    fatTargetG: 60,
    carbTargetG: 220,
  };

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
                {summary?.remainingCalories || targets.calorieTarget} kcal
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
                    (Kalan: {summary?.remainingProtein || targets.proteinTargetG}g)
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
                    (Kalan: {summary?.remainingCarbs || targets.carbTargetG}g)
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
                    (Kalan: {summary?.remainingFat || targets.fatTargetG}g)
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
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Hızlı Öğün Kaydı
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Katalogdan bir besin seçin veya son kullanılanlara tıklayın.
            </p>

            {/* Son Kullanılan Besinler Çipleri */}
            {recentFoods.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Son Kullanılanlar (Tek Tıkla Seç)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {recentFoods.map((rf) => (
                    <button
                      key={rf.id}
                      type="button"
                      onClick={() => {
                        setSelectedFoodId(rf.id);
                        setQuickGrams(String(rf.defaultGrams));
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        selectedFoodId === rf.id
                          ? "bg-brand-50 border-brand-300 text-brand-800 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {rf.name} ({rf.defaultGrams}g)
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleQuickAddFood} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Öğün Türü
                </label>
                <select
                  value={selectedMealType}
                  onChange={(e) => setSelectedMealType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="breakfast">Kahvaltı</option>
                  <option value="lunch">Öğle Yemeği</option>
                  <option value="workSnack">İş Çıkışı Ara Öğünü</option>
                  <option value="dinner">Akşam Yemeği</option>
                  <option value="extra">Ek Atıştırmalık</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Besin Seçin
                </label>
                <select
                  value={selectedFoodId}
                  onChange={(e) => setSelectedFoodId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                >
                  <option value="">-- Listeden seçin --</option>
                  {foodsList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.calories} kcal / 100g)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Miktar (Gram)
                </label>
                <input
                  type="number"
                  min="1"
                  value={quickGrams}
                  onChange={(e) => setQuickGrams(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={!selectedFoodId}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Geri Alma (Undo) Bildirimi */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="text-xs">
            <span className="font-semibold text-brand-300">{undoToast.name}</span>{" "}
            {undoToast.action === "added"
              ? "başarıyla eklendi."
              : "öğünlerden kaldırıldı."}
          </div>
          <button
            onClick={handleUndo}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Geri Al</span>
          </button>
          <button
            onClick={() => setUndoToast(null)}
            className="text-slate-400 hover:text-white p-0.5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
