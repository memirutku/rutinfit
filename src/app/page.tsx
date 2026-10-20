"use client";

import { useCallback, useEffect, useState } from "react";
import { RECENT_FOODS_KEY, parseRecentFoods, pushRecentFood, type RecentFood } from "@/lib/recent-foods";
import { buildRestorePayload } from "@/lib/food-log-restore";
import { useToday } from "@/hooks/useToday";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import { errorMessage } from "@/lib/client/api";
import { DEFAULT_TARGETS } from "@/lib/constants";
import type { MealType } from "@/lib/schemas/enums";
import type { FoodLog } from "@/lib/schemas/food";
import { useProfile } from "@/lib/client/queries/system";
import { useCreateFoodLog, useDeleteFoodLog, useFoodLogs, useFoods } from "@/lib/client/queries/nutrition";
import { useWorkouts } from "@/lib/client/queries/workouts";
import { useProgress, useSaveProgress, useToggleCreatine } from "@/lib/client/queries/progress";
import { UndoToast, type UndoToastData } from "@/components/dashboard/UndoToast";
import { QuickAddModal, type QuickAddValues } from "@/components/dashboard/QuickAddModal";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CeilingAlert } from "@/components/dashboard/CeilingAlert";
import { RhythmStepCard } from "@/components/dashboard/RhythmStepCard";
import { CalorieCard } from "@/components/dashboard/CalorieCard";
import { MacroBalanceCard } from "@/components/dashboard/MacroBalanceCard";
import { TodayWorkoutCard } from "@/components/dashboard/TodayWorkoutCard";
import { WellbeingCard, type WellbeingValues } from "@/components/dashboard/WellbeingCard";
import { TodayMealsList } from "@/components/dashboard/TodayMealsList";
import { getRhythmStep, WELLBEING_SECTION_ID, type RhythmAction } from "@/components/dashboard/rhythm";

interface UndoState {
  toast: UndoToastData;
  logId?: string;
  payload?: ReturnType<typeof buildRestorePayload>;
}

export default function DashboardPage() {
  // Gece yarısını geçen açık pencerede de doğru gün (kayıtlar yanlış güne düşmez)
  const todayStr = useToday();
  const profile = useProfile();
  const foodLogs = useFoodLogs(todayStr);
  const workouts = useWorkouts(todayStr);
  const progress = useProgress();

  // Hızlı yemek ekleme modalı: besin listesi ilk açılışta bir kez yüklenir.
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddRequested, setQuickAddRequested] = useState(false);
  const [quickAddMealType, setQuickAddMealType] = useState<MealType>("lunch");
  const foods = useFoods(50, { enabled: quickAddRequested });

  // Son kullanılan besinler ve Geri Alma (Undo) state'i
  const [recentFoods, setRecentFoods] = useLocalStorage<RecentFood[]>(RECENT_FOODS_KEY, [], parseRecentFoods);
  const [undo, setUndo] = useState<UndoState | null>(null);

  const createFoodLog = useCreateFoodLog();
  const deleteFoodLog = useDeleteFoodLog();
  const saveProgress = useSaveProgress();
  const toggleCreatine = useToggleCreatine();

  const { message: actionError, show: flashError } = useTimedMessage<string>(5000);
  const showError = useCallback((e: unknown, fallback: string) => flashError(errorMessage(e, fallback)), [flashError]);

  // İlk yüklemede tam ekran yükleniyor; sonraki yenilemeler arka planda (titreme, kaydırma kaybı yok).
  const anyPending = profile.isPending || foodLogs.isPending || workouts.isPending || progress.isPending;
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  useEffect(() => {
    if (!anyPending) setHasLoadedOnce(true);
  }, [anyPending]);

  const foodsError = foods.error;
  useEffect(() => {
    if (foodsError) showError(foodsError, "Besin listesi yüklenemedi.");
  }, [foodsError, showError]);

  function handleToggleCreatine() {
    const today = progress.data?.today;
    if (!today) return;
    toggleCreatine.mutate(
      { date: todayStr, taken: !today.creatineTaken },
      { onError: (e) => showError(e, "Kreatin kaydı güncellenemedi.") }
    );
  }

  async function handleSaveWellbeing(values: WellbeingValues): Promise<boolean> {
    try {
      await saveProgress.mutateAsync({ date: todayStr, ...values });
      return true;
    } catch (e) {
      showError(e, "Kayıt güncellenemedi.");
      return false;
    }
  }

  function handleOpenQuickAdd(preferredMealType?: MealType) {
    if (preferredMealType) setQuickAddMealType(preferredMealType);
    setIsQuickAddOpen(true);
    setQuickAddRequested(true);
    if (foods.isError) foods.refetch();
  }

  function handleRhythmAction(action: RhythmAction) {
    if (action.kind === "creatine") handleToggleCreatine();
    else if (action.kind === "quickAdd") handleOpenQuickAdd(action.mealType);
    else document.getElementById(WELLBEING_SECTION_ID)?.scrollIntoView({ behavior: "smooth" });
  }

  /** Makrolar sunucuda katalogdan hesaplanır; hata modalda gösterilir. */
  async function handleQuickAddSubmit(values: QuickAddValues) {
    const created = await createFoodLog.mutateAsync({
      date: todayStr,
      time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      mealType: values.mealType,
      foodItemId: values.foodItemId,
      name: values.name,
      grams: values.grams,
    });
    setRecentFoods((prev) => pushRecentFood(prev, { id: values.foodItemId, name: values.name, defaultGrams: values.grams }));
    setUndo({ toast: { key: `add-${created.id}`, name: created.name, action: "added" }, logId: created.id });
    setIsQuickAddOpen(false);
  }

  async function handleUndo() {
    if (!undo) return;
    try {
      if (undo.toast.action === "added" && undo.logId) {
        await deleteFoodLog.mutateAsync(undo.logId);
      } else if (undo.toast.action === "deleted" && undo.payload) {
        await createFoodLog.mutateAsync(undo.payload);
      }
      setUndo(null);
    } catch (e) {
      showError(e, "Geri alma başarısız oldu.");
    }
  }

  async function handleDeleteFoodLog(log: FoodLog) {
    try {
      await deleteFoodLog.mutateAsync(log.id);
      setUndo({ toast: { key: `del-${log.id}`, name: log.name, action: "deleted" }, payload: buildRestorePayload(log) });
    } catch (e) {
      showError(e, "Öğün silinemedi.");
    }
  }

  if (!hasLoadedOnce && anyPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">RutinFit verileriniz yükleniyor...</p>
      </div>
    );
  }

  const homeTime = profile.data?.workdayHomeTime;
  const summary = foodLogs.data?.summary;
  const targets = foodLogs.data?.targets || DEFAULT_TARGETS;

  // Haftanın gününe göre günün şablonunu belirle (1: Pazartesi ... 7: Pazar)
  const currentDayOfWeek = new Date().getDay() || 7;
  const todayTemplate = workouts.data?.templates.find((t) => t.dayOfWeek === currentDayOfWeek);
  const isWorkoutCompleted = !!workouts.data?.sessions.some((s) => s.date === todayStr && s.completed);
  const step = getRhythmStep(new Date().getHours(), homeTime, !!progress.data?.today.creatineTaken);

  return (
    <div className="space-y-6">
      <DashboardHeader homeTime={homeTime || "19:30"} onQuickAdd={() => handleOpenQuickAdd()} />
      <CeilingAlert alert={summary?.ceilingAlert} />
      <RhythmStepCard step={step} onAction={handleRhythmAction} />

      {/* Ana Metrikler: Kalori & Makrolar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CalorieCard summary={summary} targets={targets} />
        <MacroBalanceCard summary={summary} targets={targets} />
      </div>

      {/* İkinci Sıra: Günün Antrenmanı & Kreatin / İyilik Hali */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayWorkoutCard template={todayTemplate} isCompleted={isWorkoutCompleted} />
        <WellbeingCard today={progress.data?.today} onToggleCreatine={handleToggleCreatine} onSave={handleSaveWellbeing} />
      </div>

      <TodayMealsList logs={foodLogs.data?.logs ?? []} onAdd={() => handleOpenQuickAdd()} onDelete={handleDeleteFoodLog} />

      <QuickAddModal
        open={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        foods={foods.data ?? []}
        isLoadingFoods={foods.isLoading}
        recentFoods={recentFoods}
        initialMealType={quickAddMealType}
        onSubmit={handleQuickAddSubmit}
      />

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
