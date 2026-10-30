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
import { useCreateFoodLog, useDeleteFoodLog, useFoodLogs, useFoods, useQuickAddFood } from "@/lib/client/queries/nutrition";
import { useWorkouts } from "@/lib/client/queries/workouts";
import { useProgress, useSaveProgress } from "@/lib/client/queries/progress";
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
import { FASTING_SECTION_ID, getRamadanRhythmStep, getRhythmStep, WELLBEING_SECTION_ID, type RhythmAction } from "@/components/dashboard/rhythm";
import { useFasting } from "@/lib/client/queries/fasting";
import { SetupWizard } from "@/components/onboarding/SetupWizard";
import { DrinksCard } from "@/components/dashboard/DrinksCard";
import { SavedMealsModal } from "@/components/dashboard/SavedMealsModal";
import { computeReadiness } from "@/lib/readiness";
import { useAllCustomMeasures } from "@/lib/client/queries/measures";
import { NaturalLogModal } from "@/components/dashboard/NaturalLogModal";
import { SupplementsCard } from "@/components/dashboard/SupplementsCard";
import { FastingCard } from "@/components/dashboard/FastingCard";
import { mealTypeForHour } from "@/lib/meal-time";
import { weightGoalProgress } from "@/lib/weight-goal";
import { formatNumberTr } from "@/lib/format";
import { WeightGoalCard } from "@/components/dashboard/WeightGoalCard";

interface UndoState {
  toast: UndoToastData;
  logId?: string;
  payload?: ReturnType<typeof buildRestorePayload>;
}

export default function DashboardPage() {
  // Gece yarısını geçen açık pencerede de doğru gün (kayıtlar yanlış güne düşmez)
  const todayStr = useToday();
  const profile = useProfile();
  const hideNumbers = profile.data?.hideNumbers ?? false;
  // F76: Ramazan modunda öğün adları sahur/iftar olur.
  const ramadan = profile.data?.ramadanMode ?? false;
  // F09: kurulmamış profilde sihirbaz açılır; "Şimdilik geç" bu oturum için kapatır.
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const [savedMealsOpen, setSavedMealsOpen] = useState(false);
  const [naturalLogOpen, setNaturalLogOpen] = useState(false);
  const quickFood = useQuickAddFood();
  const showWizard = profile.data?.isOnboarded === false && !wizardDismissed;
  const foodLogs = useFoodLogs(todayStr);
  const workouts = useWorkouts(todayStr);
  const progress = useProgress();
  // B25: Ramazan günlerinde pano imsak/iftara göre düzenlenir.
  const fasting = useFasting();
  const ramadanStatus = fasting.data?.ramadan ?? null;
  const ramadanActive = !!ramadanStatus && ramadanStatus.period?.inRamadan !== false;

  // Hızlı yemek ekleme modalı: besin listesi ilk açılışta bir kez yüklenir.
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddRequested, setQuickAddRequested] = useState(false);
  const [quickAddMealType, setQuickAddMealType] = useState<MealType>("lunch");
  // F02: hızlı eklemede sık ve yakın zamanda kullanılanlar önce gelir.
  const foods = useFoods(200, { enabled: quickAddRequested, sort: "usage" });
  // F73: kullanıcının ev ölçüleri
  const customMeasures = useAllCustomMeasures(quickAddRequested);

  // Son kullanılan besinler ve Geri Alma (Undo) state'i
  const [recentFoods, setRecentFoods] = useLocalStorage<RecentFood[]>(RECENT_FOODS_KEY, [], parseRecentFoods);
  const [undo, setUndo] = useState<UndoState | null>(null);

  const createFoodLog = useCreateFoodLog();
  const deleteFoodLog = useDeleteFoodLog();
  const saveProgress = useSaveProgress();

  const { message: actionError, show: flashError } = useTimedMessage<string>(5000);
  // B07: kilo kaydından sonra hedef kartında kısa ilerleme mesajı.
  const weightSaved = useTimedMessage<boolean>(8000);
  const showError = useCallback((e: unknown, fallback: string) => flashError(errorMessage(e, fallback)), [flashError]);

  // İlk yüklemede tam ekran yükleniyor; sonraki yenilemeler arka planda (titreme, kaydırma kaybı yok).
  const anyPending = profile.isPending || foodLogs.isPending || workouts.isPending || progress.isPending;
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  if (!anyPending && !hasLoadedOnce) setHasLoadedOnce(true);

  const foodsError = foods.error;
  useEffect(() => {
    if (foodsError) showError(foodsError, "Besin listesi yüklenemedi.");
  }, [foodsError, showError]);

  async function handleSaveWellbeing(values: WellbeingValues): Promise<boolean> {
    try {
      await saveProgress.mutateAsync({ date: todayStr, ...values });
      if (values.weightKg !== undefined) weightSaved.show(true);
      return true;
    } catch (e) {
      showError(e, "Kayıt güncellenemedi.");
      return false;
    }
  }

  function handleOpenQuickAdd(preferredMealType?: MealType) {
    // B13: öğün verilmediyse günün saatine göre seçilir.
    setQuickAddMealType(preferredMealType ?? mealTypeForHour(new Date().getHours()));
    setIsQuickAddOpen(true);
    setQuickAddRequested(true);
    if (foods.isError) foods.refetch();
  }

  function handleRhythmAction(action: RhythmAction) {
    if (action.kind === "quickAdd") handleOpenQuickAdd(action.mealType);
    else if (action.kind === "scrollToFasting") document.getElementById(FASTING_SECTION_ID)?.scrollIntoView({ behavior: "smooth" });
    else document.getElementById(WELLBEING_SECTION_ID)?.scrollIntoView({ behavior: "smooth" });
  }

  /** Makrolar sunucuda katalogdan hesaplanır; hata modalda gösterilir. */
  async function handleQuickAddSubmit(values: QuickAddValues) {
    const created = await createFoodLog.mutateAsync({
      date: todayStr,
      time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      mealType: values.mealType,
      // B01: hızlı eklemede tarif de seçilebilir.
      ...(values.recipeId ? { recipeId: values.recipeId } : { foodItemId: values.foodItemId }),
      name: values.name,
      grams: values.grams,
    });
    if (!values.recipeId) setRecentFoods((prev) => pushRecentFood(prev, { id: values.foodItemId, name: values.name, defaultGrams: values.grams }));
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

  // B02: rutin bandı (eve varış, iş/okul çıkışı) yalnız kullanıcı gün düzenini girdiyse.
  const dayPattern = profile.data?.dayPattern ?? null;
  const homeTime = dayPattern === "office" || dayPattern === "school" ? profile.data?.workdayHomeTime : undefined;
  // B02: sihirbaz tamamlanmadıysa hedefler tahminidir; kalıcı şerit sihirbazı yeniden açar.
  const estimatedTargets = profile.data?.isOnboarded === false;
  const lastWeightKg = progress.data?.weights.at(-1)?.weightKg ?? (profile.data?.isOnboarded ? profile.data.currentWeightKg : null);
  const summary = foodLogs.data?.summary;
  const targets = foodLogs.data?.targets || DEFAULT_TARGETS;

  // Haftanın gününe göre günün şablonunu belirle (1: Pazartesi ... 7: Pazar)
  const currentDayOfWeek = new Date().getDay() || 7;
  const todayTemplate = workouts.data?.templates.find((t) => t.dayOfWeek === currentDayOfWeek);
  const isWorkoutCompleted = !!workouts.data?.sessions.some((s) => s.date === todayStr && s.completed);
  // F51: kaydedilmiş bugünkü durumdan hazır olma.
  const readiness = progress.data ? computeReadiness(progress.data.today) : null;
  const step = ramadanActive && ramadanStatus ? getRamadanRhythmStep(ramadanStatus) : getRhythmStep(new Date().getHours(), { dayPattern, homeTime });
  const goalType = profile.data?.goalType;
  const weightGoal =
    profile.data?.isOnboarded && (goalType === "lose" || goalType === "gain")
      ? weightGoalProgress({
          startKg: profile.data.currentWeightKg,
          targetKg: profile.data.targetWeightKg ?? null,
          goalType,
          rateKgPerWeek: profile.data.goalRateKgPerWeek ?? 0.5,
          latest: progress.data?.weights.at(-1) ?? null,
          today: todayStr,
        })
      : null;
  const weightNote =
    weightSaved.message && weightGoal
      ? hideNumbers
        ? "Kilo kaydedildi."
        : weightGoal.reached
          ? "Kilo kaydedildi. Hedefine ulaştın!"
          : `Kilo kaydedildi. Hedefine ${formatNumberTr(weightGoal.remainingKg)} kg kaldı.`
      : null;

  return (
    <div className="space-y-6">
      <DashboardHeader homeTime={homeTime} onQuickAdd={() => handleOpenQuickAdd()} />
      {estimatedTargets && !showWizard && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900">
          <p className="text-sm">
            <span className="font-bold">Hedeflerin tahmini.</span> Boy, kilo ve hedefini girersen kalori ve makrolar sana göre
            hesaplanır.
          </p>
          <button
            type="button"
            onClick={() => setWizardDismissed(false)}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
          >
            Profilini tamamla
          </button>
        </div>
      )}
      <CeilingAlert alert={summary?.ceilingAlert} hideNumbers={hideNumbers} />
      {/* B25: Ramazan'da vakit kartı en üstte */}
      {ramadanActive && <FastingCard />}
      <RhythmStepCard step={step} onAction={handleRhythmAction} />

      {/* Ana Metrikler: Kalori & Makrolar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CalorieCard summary={summary} targets={targets} hideNumbers={hideNumbers} estimated={estimatedTargets} />
        <MacroBalanceCard summary={summary} targets={targets} hideNumbers={hideNumbers} />
      </div>

      {/* B07: kilo hedefine ilerleme (hedef kilo girildiyse) */}
      {weightGoal && (goalType === "lose" || goalType === "gain") && (
        <WeightGoalCard progress={weightGoal} goalType={goalType} hideNumbers={hideNumbers} note={weightNote} />
      )}

      {/* İkinci Sıra: Günün Antrenmanı & İyilik Hali */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayWorkoutCard template={todayTemplate} isCompleted={isWorkoutCompleted} readiness={readiness} />
        <WellbeingCard
          today={progress.data?.today}
          onSave={handleSaveWellbeing}
          cycleTracking={profile.data?.cycleTracking ?? false}
          lastWeightKg={lastWeightKg}
        />
      </div>

      {/* F13: sıvı, kafein ve alkol · F15: takviyeler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DrinksCard date={todayStr} hideAlcohol={ramadanActive} />
        <SupplementsCard date={todayStr} />
      </div>

      {/* F76 + F14: Ramazan vakitleri ve aralıklı oruç (açıksa; Ramazan'da yukarıda) */}
      {!ramadanActive && <FastingCard />}

      <TodayMealsList
        ramadan={ramadan}
        logs={foodLogs.data?.logs ?? []}
        onAdd={() => handleOpenQuickAdd()}
        onDelete={handleDeleteFoodLog}
        hideNumbers={hideNumbers}
        onOpenSavedMeals={() => setSavedMealsOpen(true)}
        onOpenNaturalLog={() => setNaturalLogOpen(true)}
        onQuickFood={(item, count, mealType) =>
          quickFood.mutate({ item, count, date: todayStr, mealType }, { onError: (e) => showError(e, "Eklenemedi.") })
        }
      />

      <NaturalLogModal
        open={naturalLogOpen}
        date={todayStr}
        defaultMealType={mealTypeForHour(new Date().getHours())}
        onClose={() => setNaturalLogOpen(false)}
      />

      <SavedMealsModal
        open={savedMealsOpen}
        date={todayStr}
        todayLogs={foodLogs.data?.logs ?? []}
        hideNumbers={hideNumbers}
        onClose={() => setSavedMealsOpen(false)}
      />

      <QuickAddModal
        open={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        foods={foods.data ?? []}
        isLoadingFoods={foods.isLoading}
        recentFoods={recentFoods}
        initialMealType={quickAddMealType}
        onSubmit={handleQuickAddSubmit}
        customMeasures={customMeasures.data}
        ramadan={ramadan}
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
      <SetupWizard open={showWizard} profile={profile.data} onClose={() => setWizardDismissed(true)} />
    </div>
  );
}
