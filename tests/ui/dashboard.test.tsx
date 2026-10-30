import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/page";
import { getRamadanRhythmStep, getRhythmStep } from "@/components/dashboard/rhythm";
import { RhythmStepCard } from "@/components/dashboard/RhythmStepCard";
import { CeilingAlert } from "@/components/dashboard/CeilingAlert";
import { CalorieCard } from "@/components/dashboard/CalorieCard";
import { MacroBalanceCard } from "@/components/dashboard/MacroBalanceCard";
import { TodayWorkoutCard, TodayWorkoutView } from "@/components/dashboard/TodayWorkoutCard";
import { weekdayOf } from "@/lib/workout-day";
import { TodayMealsList, dashboardMealLabel } from "@/components/dashboard/TodayMealsList";
import { WellbeingCard, toWellbeingValues } from "@/components/dashboard/WellbeingCard";
import { WeightGoalCard } from "@/components/dashboard/WeightGoalCard";
import { mealTypeForHour } from "@/lib/meal-time";
import { getLocalDateString } from "@/lib/date-utils";
import type { DailySummary, FoodLog, FoodLogsResponse } from "@/lib/schemas/food";
import type { ProgressResponse } from "@/lib/schemas/progress";
import type { WorkoutSession, WorkoutTemplate } from "@/lib/schemas/workout";
import { jsonResponse, stubFetch } from "../helpers/fetch";
import { renderWithQuery } from "../helpers/query";

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  restore = undefined;
});

const today = getLocalDateString();
const PROFILE_FIXTURE = {
  id: "default-user", heightCm: 181, age: 25, sex: "male", currentWeightKg: 112, calorieTarget: 2080, calorieCeiling: 2100,
  proteinTargetG: 165, fatTargetG: 60, carbTargetG: 220, wakeTime: "06:00", workdayHomeTime: "19:30", isOnboarded: true,
  dayPattern: "office",
};
const targets = { calorieTarget: 1950, calorieCeiling: 2100, proteinTargetG: 165, fatTargetG: 60, carbTargetG: 220 };

const summary = (over: Partial<DailySummary> = {}): DailySummary => ({
  consumedCalories: 500,
  consumedProtein: 40,
  consumedCarbs: 60,
  consumedFat: 15,
  remainingCalories: 1450,
  remainingProtein: 125,
  remainingCarbs: 160,
  remainingFat: 45,
  progressPercent: { calories: 25, protein: 24, carbs: 27, fat: 25 },
  ceilingAlert: { isApproaching: false, isExceeded: false, diffFromCeiling: 1600, message: null },
  ...over,
});

const log = (over: Partial<FoodLog> = {}): FoodLog => ({
  id: "log1",
  date: today,
  time: "12:30",
  mealType: "lunch",
  foodItemId: "f1",
  recipeId: null,
  name: "Tavuk Göğsü",
  grams: 123,
  caloriesSnapshot: 203,
  proteinSnapshot: 38,
  carbsSnapshot: 0,
  fatSnapshot: 4.4,
  ...over,
});

const progress = (taken: boolean): ProgressResponse => ({
  weights: [],
  wellbeings: [],
  measurements: [],
  creatineCompliance: [{ date: today, taken }],
  weeklyWeightDelta: 0,
  today: { date: today, creatineTaken: taken, weightKg: 110.5, energy1to5: 4, sleepMinutes: 450, hunger1to5: null },
});

const template: WorkoutTemplate = {
  id: "t1",
  name: "Ağırlık A",
  type: "strength",
  dayOfWeek: 1,
  targetDurationMinutes: 45,
  notes: "Göğüs ve sırt",
  exercises: [],
};

describe("getRhythmStep", () => {
  it.each([
    [8, "Güne Başlangıç", { kind: "scrollToWellbeing" }],
    [13, "Öğle Öğünü", { kind: "quickAdd", mealType: "lunch" }],
    [17, "İkindi Ara Öğünü", { kind: "quickAdd", mealType: "workSnack" }],
    [20, "Akşam Yemeği", { kind: "quickAdd", mealType: "dinner" }],
    [23, "Gece Kapanışı & Kaliteli Uyku", { kind: "scrollToWellbeing" }],
  ])("B02: gün düzeni girilmemişse saat %i → %s (iş/kreatin varsayımı yok)", (hour, title, action) => {
    const step = getRhythmStep(hour);
    expect(step.title).toBe(title);
    expect(step.action).toEqual(action);
    expect(`${step.title} ${step.description} ${step.badge} ${step.actionText}`).not.toMatch(/kreatin|iş çıkışı|eve varış/i);
  });

  it("ofis düzeninde eve varış saatini kullanır; okul düzeninde okul çıkışı der", () => {
    const office = { dayPattern: "office" as const, homeTime: "20:00" };
    expect(getRhythmStep(17, office).title).toBe("İş Çıkışı & Antrenman Hazırlığı");
    expect(getRhythmStep(17, office).time).toBe("17:00 - 20:00");
    expect(getRhythmStep(20, office).time).toBe("20:00 - 21:30");
    expect(getRhythmStep(17, { dayPattern: "school", homeTime: "16:30" }).title).toBe("Okul Çıkışı & Ara Öğün");
    expect(getRhythmStep(17, { dayPattern: "shift", homeTime: "08:00" }).title).toBe("İkindi Ara Öğünü");
  });
});

describe("B25: Ramazan ritmi", () => {
  const status = (phase: "sahur" | "fasting" | "evening", minutesLeft: number) => ({
    phase,
    minutesLeft,
    today: { date: today, imsak: "06:06", iftar: "18:35" },
    tomorrow: { date: today, imsak: "06:05", iftar: "18:36" },
    waterAdvice: "İftar ile sahur arasında 2.500 ml hedefle.",
  });

  it("aşamaya göre sahur, oruç ve iftar adımı verir; oruçta öğün önermez", () => {
    expect(getRamadanRhythmStep(status("sahur", 90))).toMatchObject({ title: "Sahur", action: { kind: "quickAdd", mealType: "breakfast" } });
    const fasting = getRamadanRhythmStep(status("fasting", 200));
    expect(fasting).toMatchObject({ title: "Oruç", time: "06:06 - 18:35", action: { kind: "scrollToFasting" } });
    expect(fasting.description).toContain("İftara 3 sa 20 dk");
    // 18:35 iftar; kalan 1440 - 19:05 + 06:05 → iftardan 30 dk sonra
    expect(getRamadanRhythmStep(status("evening", 1440 - (19 * 60 + 5) + (6 * 60 + 5)))).toMatchObject({ title: "İftar", action: { kind: "quickAdd", mealType: "dinner" } });
    expect(getRamadanRhythmStep(status("evening", 300)).title).toBe("Gece: Su ve Dinlenme");
  });
});

describe("dashboard kartları", () => {
  it("RhythmStepCard düğmesi adımın eylemini bildirir", () => {
    const onAction = vi.fn();
    render(<RhythmStepCard step={getRhythmStep(13)} onAction={onAction} />);
    expect(screen.getByText(/Sıradaki Adım · 12:00 - 15:30/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Öğle Yemeği Ekle/ }));
    expect(onAction).toHaveBeenCalledWith({ kind: "quickAdd", mealType: "lunch" });
  });

  it("CeilingAlert mesaj yoksa görünmez, aşımda başlığı değişir", () => {
    const { container, rerender } = render(<CeilingAlert alert={summary().ceilingAlert} />);
    expect(container.textContent).toBe("");
    rerender(
      <CeilingAlert alert={{ isApproaching: true, isExceeded: true, diffFromCeiling: -50, message: "Tavanı 50 kcal aştın" }} />
    );
    expect(screen.getByText("Günlük Kalori Üst Sınırı")).toBeTruthy();
    expect(screen.getByText("Tavanı 50 kcal aştın")).toBeTruthy();
  });

  it("CalorieCard hedefi, kalanı ve tavanı gösterir; özet yoksa hedeften başlar", () => {
    const { rerender } = render(<CalorieCard summary={summary()} targets={targets} />);
    expect(screen.getByText("/ 1950 kcal")).toBeTruthy();
    expect(screen.getByText("1450 kcal")).toBeTruthy();
    expect(screen.getByText(/Üst sınır: 2100 kcal/)).toBeTruthy();
    rerender(<CalorieCard targets={targets} />);
    expect(screen.getByText("1950 kcal")).toBeTruthy();
  });

  it("MacroBalanceCard her makro için tüketilen ve kalanı gösterir", () => {
    render(<MacroBalanceCard summary={summary()} targets={targets} />);
    expect(screen.getByText("Protein (Hedef: 165g)")).toBeTruthy();
    expect(screen.getByText("(Kalan: 125g)")).toBeTruthy();
    expect(screen.getByText("Sağlıklı Yağ (Hedef: 60g)")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Detaylı Plan/ }).getAttribute("href")).toBe("/nutrition");
  });

  it("B23: makro gramları Türkçe ondalıkla gösterilir", () => {
    render(<MacroBalanceCard summary={summary({ consumedFat: 12.5, remainingFat: 47.5 })} targets={targets} />);
    expect(screen.getByText("(Kalan: 47,5g)")).toBeTruthy();
    expect(screen.getByText(/12,5g \/ 60g/)).toBeTruthy();
  });

  it("F56: sayıları gizleme modunda kalori, makro ve öğün sayıları görünmez; ilerleme sözle anlatılır", () => {
    const { container: cal } = render(<CalorieCard summary={summary()} targets={targets} hideNumbers />);
    expect(cal.textContent).not.toMatch(/\d+\s*kcal/);
    expect(cal.textContent).toMatch(/Güne başladın|Hedefe yaklaşıyorsun|Hedefe ulaştın|Tavanın üzerindesin/);

    const { container: macros } = render(<MacroBalanceCard summary={summary()} targets={targets} hideNumbers />);
    expect(macros.textContent).not.toMatch(/\d+g/);
    expect(macros.textContent).toContain("Protein");

    const { container: meals } = renderWithQuery(<TodayMealsList logs={[log()]} onAdd={vi.fn()} onDelete={vi.fn()} hideNumbers />);
    expect(meals.textContent).not.toMatch(/kcal/);

    const { container: alert } = render(
      <CeilingAlert alert={{ isApproaching: true, isExceeded: true, diffFromCeiling: -50, message: "Tavanı 50 kcal aştın" }} hideNumbers />
    );
    expect(alert.textContent).not.toMatch(/\d/);
  });

  it("F79: öğün listesindeki hızlı Türk sofrası düğmeleri kalemi, adedi ve öğünü bildirir", () => {
    // B13: öğün sınırında soru çıkar; sınırdan uzak bir saat sabitlenir.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 30, 13, 0));
    const onQuickFood = vi.fn();
    renderWithQuery(<TodayMealsList logs={[]} onAdd={vi.fn()} onDelete={vi.fn()} onQuickFood={onQuickFood} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Simit" }));
    fireEvent.click(screen.getByRole("button", { name: "+ 2 dilim ekmek" }));
    expect(onQuickFood.mock.calls).toEqual([["simit", 1, "lunch"], ["ekmek-dilimi", 2, "lunch"]]);
    vi.useRealTimers();
  });

  it("F51: hazır olma düşükse antrenman kartı kısaltılmış seansı önerir", () => {
    const todayTpl = { ...template, dayOfWeek: weekdayOf(today) };
    const { rerender } = render(
      <TodayWorkoutView status={{ planned: todayTpl, completed: false, doneOther: [] }} readiness={{ score: 32, band: "low", contributions: [], drags: ["Uyku 5 sa"] }} />
    );
    expect(screen.getByRole("note").textContent).toMatch(/Hazır olma düşük \(32\)/);
    rerender(<TodayWorkoutView status={{ planned: todayTpl, completed: false, doneOther: [] }} readiness={{ score: 80, band: "high", contributions: [], drags: [] }} />);
    expect(screen.queryByRole("note")).toBeNull();
  });

  describe("TodayWorkoutCard (B20: kendi verisini alır)", () => {
    const sessionOf = (over: Partial<WorkoutSession>): WorkoutSession => ({
      id: "s1", date: today, templateId: null, name: "x", durationMinutes: 60, rpe: 7, notes: null, completed: true, setLogs: [], ...over,
    });
    const lowerB: WorkoutTemplate = {
      id: "lb", name: "Alt Gövde B", type: "strength", dayOfWeek: weekdayOf(today), targetDurationMinutes: 60, notes: null,
      exercises: [
        { id: "e1", exerciseName: "Deadlift", targetSets: 3, repMin: 4, repMax: 6, restSeconds: 180, orderIndex: 0 },
        { id: "e2", exerciseName: "Leg Press", targetSets: 3, repMin: 10, repMax: 12, restSeconds: 120, orderIndex: 1 },
      ],
    };
    const upperA: WorkoutTemplate = { ...lowerB, id: "ua", name: "Üst Gövde A", dayOfWeek: (weekdayOf(today) % 7) + 1 };
    function stubToday(sessions: WorkoutSession[], templates: WorkoutTemplate[] = [upperA, lowerB]) {
      const s = stubFetch([["/api/workouts", () => jsonResponse({ templates, sessions })]]);
      restore = s.restore;
      return s;
    }

    it("Mert: Üst Gövde A yapıldıysa bugünün Alt Gövde B'si 'Tamamlandı' görünmez; yapılan ayrıca yazılır", async () => {
      const s = stubToday([sessionOf({ templateId: "ua", name: "Üst Gövde A" })]);
      renderWithQuery(<TodayWorkoutCard readiness={null} />);
      expect(await screen.findByText("Alt Gövde B")).toBeTruthy();
      expect(screen.getByText("Bekliyor")).toBeTruthy();
      expect(screen.queryByText("Tamamlandı ✓")).toBeNull();
      expect(screen.getByText(/Bugün yapılan: Üst Gövde A ✓/)).toBeTruthy();
      expect(s.calls[0].url).toContain(`/api/workouts?date=${today}`);
    });

    it("bugünün şablonu yapıldıysa 'Tamamlandı'; açıklama şablondan gelir, kişisel saat yazmaz", async () => {
      stubToday([sessionOf({ templateId: "lb", name: "Alt Gövde B" })]);
      const { container } = renderWithQuery(<TodayWorkoutCard readiness={null} />);
      expect(await screen.findByText("Tamamlandı ✓")).toBeTruthy();
      expect(screen.getByText("2 hareket · 6 set: Deadlift, Leg Press")).toBeTruthy();
      expect(screen.getByRole("link", { name: /Seansı Gör/ }).getAttribute("href")).toBe("/workouts#gecmis");
      expect(screen.queryByRole("link", { name: "Hafiflet" })).toBeNull();
      expect(container.textContent).not.toMatch(/İş Çıkışı|19:40|Toparlanma günü/);
    });

    it("bekleyen seans; şablon yoksa dinlenme günüdür", async () => {
      stubToday([]);
      renderWithQuery(<TodayWorkoutCard readiness={null} />);
      expect(await screen.findByText("Bekliyor")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Hafiflet" })).toBeTruthy();
      restore?.();
      stubToday([], [upperA]);
      renderWithQuery(<TodayWorkoutCard readiness={null} />);
      expect(await screen.findByText("Dinlenme günü")).toBeTruthy();
    });
  });

  it("TodayMealsList boş durumu ve silme düğmesi", () => {
    const onDelete = vi.fn();
    const onAdd = vi.fn();
    const { rerender } = renderWithQuery(<TodayMealsList logs={[]} onAdd={onAdd} onDelete={onDelete} />);
    expect(screen.getByText("Henüz bugün için bir öğün kaydetmediniz")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Öğün Ekle/ }));
    expect(onAdd).toHaveBeenCalled();

    const l = log({ mealType: "workSnack" });
    rerender(<TodayMealsList logs={[l]} onAdd={onAdd} onDelete={onDelete} />);
    expect(screen.getByText("İkindi")).toBeTruthy();
    expect(screen.getByText(/123g · 203 kcal · P: 38g · K: 0g · Y: 4.4g/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tavuk Göğsü öğününü sil" }));
    expect(onDelete).toHaveBeenCalledWith(l);
  });

  it("öğün etiketleri ana panelin kısa adlarını kullanır", () => {
    expect(["breakfast", "lunch", "workSnack", "dinner", "extra", "snack"].map((t) => dashboardMealLabel(t))).toEqual([
      "Kahvaltı",
      "Öğle Yemeği",
      "İkindi",
      "Akşam Yemeği",
      "Ara Öğün",
      "Ara Öğün",
    ]);
  });
});

describe("B07: WeightGoalCard", () => {
  const p = { startKg: 90, currentKg: 88, targetKg: 75, changedKg: 2, remainingKg: 13, percent: 13, weeksLeft: 26, etaDate: "2027-04-30", reached: false };

  it("güncel kilo, verilen ve kalan kg ile tahmini varışı gösterir", () => {
    render(<WeightGoalCard progress={p} goalType="lose" note="Kilo kaydedildi. Hedefine 13 kg kaldı." />);
    const card = screen.getByRole("region", { name: "Kilo hedefim" });
    expect(card.textContent).toContain("88 kg");
    expect(card.textContent).toContain("2 kg verdin");
    expect(card.textContent).toContain("13 kg kaldı");
    expect(card.textContent).toContain("Tahmini varış: 30.04.2027");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("13");
    expect(screen.getByRole("status").textContent).toContain("13 kg kaldı");
  });

  it("sayıları gizle modunda kilo yazmaz, sözel ilerleme verir", () => {
    render(<WeightGoalCard progress={p} goalType="lose" hideNumbers />);
    const card = screen.getByRole("region", { name: "Kilo hedefim" });
    expect(card.textContent).not.toMatch(/\d+ kg/);
    expect(card.textContent).toContain("İlk adımları attın");
  });
});

describe("WellbeingCard", () => {
  it("form değerlerini kayıt gövdesine çevirir", () => {
    expect(toWellbeingValues("112,5", "7,5", 4)).toEqual({ weightKg: 112.5, energy1to5: 4, sleepMinutes: 450 });
    // B04: boş alan kaydedilmez (enerji 3, uyku 7 saat uydurulmaz).
    expect(toWellbeingValues("", "", null)).toEqual({});
    expect(toWellbeingValues("72,4", "", null)).toEqual({ weightKg: 72.4 });
  });

  it("B04: kayıt yokken alanlar boş başlar, hazır olma görünmez; yalnız girilen alan kaydedilir", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const empty = { date: today, creatineTaken: false, weightKg: null, energy1to5: null, sleepMinutes: null, hunger1to5: null };
    render(<WellbeingCard today={empty} onSave={onSave} lastWeightKg={71.2} />);
    expect((screen.getByLabelText("Uyku (saat)") as HTMLInputElement).value).toBe("");
    expect(screen.getByText("— / 5")).toBeTruthy();
    expect(screen.queryByText(/Hazır olma/)).toBeNull();
    const weight = screen.getByLabelText("Sabah Kilosu (kg)") as HTMLInputElement;
    expect(weight.placeholder).toBe("Örn: 71,2");
    fireEvent.change(weight, { target: { value: "70,9" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Kaydet" })));
    expect(onSave).toHaveBeenLastCalledWith({ weightKg: 70.9 });
  });

  it("sunucu değerleriyle dolar; aynı veri tekrar gelince yazılanı ezmez, değişince yeniden dolar", () => {
    const props = { onSave: vi.fn() };
    const { rerender } = render(<WellbeingCard today={progress(false).today} {...props} />);
    const weight = screen.getByLabelText("Sabah Kilosu (kg)") as HTMLInputElement;
    expect(weight.value).toBe("110,5");
    expect((screen.getByLabelText("Uyku (saat)") as HTMLInputElement).value).toBe("7,5");
    expect(screen.getByText("4 / 5")).toBeTruthy();

    fireEvent.change(weight, { target: { value: "109" } });
    // Kreatin değişti, iyilik hali aynı: kullanıcının yazdığı korunur.
    rerender(<WellbeingCard today={progress(true).today} {...props} />);
    expect(weight.value).toBe("109");

    rerender(<WellbeingCard today={{ ...progress(true).today, weightKg: 108.2 }} {...props} />);
    expect(weight.value).toBe("108,2");
  });

  it("F51: stres, kas ağrısı ve ruh hâli seçilir; hazır olma skoru canlı hesaplanır ve kaydedilir", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<WellbeingCard today={{ ...progress(false).today, energy1to5: 2, sleepMinutes: 300 }} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Stres 4/5" }));
    fireEvent.click(screen.getByRole("button", { name: "Kas ağrısı 4/5" }));
    fireEvent.click(screen.getByRole("button", { name: "Ruh hâli 2/5" }));
    expect(screen.getByText(/Hazır olma: 30 · Düşük/)).toBeTruthy();
    expect(screen.getByText(/Düşüren: Enerji 2\/5, Uyku 5 sa/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ energy1to5: 2, sleepMinutes: 300, stress1to5: 4, soreness1to5: 4, mood1to5: 2 });
  });

  it("kayıt başarılıysa onay gösterir, başarısızsa göstermez", async () => {
    const onSave = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    render(<WellbeingCard today={progress(false).today} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Kaydet" })));
    expect(onSave).toHaveBeenLastCalledWith({ weightKg: 110.5, energy1to5: 2, sleepMinutes: 450 });
    expect(screen.getByText("Kayıt güncellendi ✓")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Kaydet" })));
    expect(screen.queryByText("Kayıt güncellendi ✓")).toBeNull();
  });
});

describe("DashboardPage", () => {
  function stubDashboard(opts: { progressPost?: () => Response | Promise<Response>; supplementPost?: () => Response | Promise<Response>; logs?: FoodLog[]; profile?: Record<string, unknown>; fasting?: unknown } = {}) {
    let taken = false;
    const creatine = () => ({ id: "s1", name: "Kreatin Monohidrat", doseAmount: 5, doseUnit: "g", active: true, notes: null, takenToday: taken, takenLast7: taken ? 1 : 0 });
    const foodLogs = (): FoodLogsResponse => ({ date: today, logs: opts.logs ?? [log()], summary: summary(), targets });
    const s = stubFetch([
      ["/api/food-logs", (_u, init) => (init?.method === "DELETE" ? jsonResponse({ success: true }) : init?.method === "POST" ? jsonResponse(log({ id: "log2" }), 201) : jsonResponse(foodLogs()))],
      ["/api/workouts", () => jsonResponse({ templates: [], sessions: [] })],
      [
        "/api/progress",
        (_u, init) => {
          if (init?.method === "POST") return opts.progressPost ? opts.progressPost() : ((taken = !taken), jsonResponse({ success: true }));
          return jsonResponse(progress(taken));
        },
      ],
      ["/api/profile", () => jsonResponse({ ...PROFILE_FIXTURE, workdayHomeTime: "20:15", ...opts.profile })],
      ["/api/supplements/log", () => (opts.supplementPost ? opts.supplementPost() : ((taken = !taken), jsonResponse({ success: true })))],
      ["/api/supplements", () => jsonResponse({ supplements: [creatine()] })],
      ["/api/fasting", () => jsonResponse(opts.fasting ?? { ramadan: null, timer: { targetHours: null, active: null, recent: [] } })],
    ]);
    restore = s.restore;
    return s;
  }

  it("ilk yüklemede tam ekran yükleniyor, sonra verileri gösterir", async () => {
    stubDashboard();
    renderWithQuery(<DashboardPage />);
    expect(screen.getByText("RutinFit verileriniz yükleniyor...")).toBeTruthy();
    expect(await screen.findByText("/ 1950 kcal")).toBeTruthy();
    expect(screen.getByText(/Eve tahmini varış: 20:15/)).toBeTruthy();
    expect(screen.getByText("Tavuk Göğsü")).toBeTruthy();
  });

  it("F09: profil kurulmamışsa kurulum sihirbazı açılır; 'Şimdilik geç' kapatır", async () => {
    const s = stubDashboard();
    s.restore();
    restore = stubFetch([
      ["/api/food-logs", () => jsonResponse({ date: today, logs: [], summary: summary(), targets })],
      ["/api/workouts", () => jsonResponse({ templates: [], sessions: [] })],
      ["/api/progress", () => jsonResponse(progress(false))],
      ["/api/profile", () => jsonResponse({ ...PROFILE_FIXTURE, isOnboarded: false })],
    ]).restore;
    renderWithQuery(<DashboardPage />);
    expect(await screen.findByRole("dialog", { name: /Hedeflerini birlikte kuralım/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Şimdilik geç" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // B02: sihirbaz atlanınca hedefler "tahmini" ve kalıcı şerit sihirbazı yeniden açar.
    expect(screen.getByText(/Hedeflerin tahmini/)).toBeTruthy();
    expect(screen.getByText("Tahmini hedef")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Profilini tamamla" }));
    expect(await screen.findByRole("dialog", { name: /Hedeflerini birlikte kuralım/ })).toBeTruthy();
  });

  it("B07: hedef kilo varsa panoda ilerleme kartı; kilo kaydından sonra kalan kg mesajı", async () => {
    stubDashboard({ profile: { currentWeightKg: 112, targetWeightKg: 100, goalType: "lose", goalRateKgPerWeek: 0.5 } });
    renderWithQuery(<DashboardPage />);
    const card = await screen.findByRole("region", { name: "Kilo hedefim" });
    expect(card.textContent).toContain("12 kg kaldı");
    fireEvent.change(screen.getByLabelText("Sabah Kilosu (kg)"), { target: { value: "110,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(await screen.findByText(/Kilo kaydedildi\. Hedefine 12 kg kaldı\./)).toBeTruthy();
  });

  it("B25: Ramazan günlerinde vakit kartı en üstte, ritim oruca göre, alkol satırı yok", async () => {
    const t = (date: string, imsak: string, iftar: string) => ({ date, imsak, iftar, fastMinutes: 749 });
    stubDashboard({
      fasting: {
        ramadan: {
          province: "Ankara",
          today: t(today, "06:06", "18:35"),
          tomorrow: t(today, "06:05", "18:36"),
          phase: "fasting",
          minutesLeft: 200,
          progressPercent: 40,
          waterAdvice: "su",
          period: { inRamadan: true, day: 3, start: today, end: today, daysUntil: 0 },
        },
        timer: { targetHours: null, active: null, recent: [] },
      },
    });
    renderWithQuery(<DashboardPage />);
    const fastingCard = await screen.findByText("Ramazan · Ankara");
    const rhythm = screen.getByRole("heading", { name: "Oruç" });
    expect(fastingCard.compareDocumentPosition(rhythm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/İftara 3 sa 20 dk kaldı/)).toBeTruthy();
    expect(screen.queryByText("Alkol")).toBeNull();
  });

  it("B13: 'Hızlı Öğün Ekle' öğünü günün saatine göre seçer (hep öğle değil)", async () => {
    stubDashboard();
    renderWithQuery(<DashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Hızlı Öğün Ekle" }));
    const select = (await screen.findByLabelText("Öğün Türü")) as HTMLSelectElement;
    expect(select.value).toBe(mealTypeForHour(new Date().getHours()));
  });

  it("B02: gün düzeni girilmemişse eve varış saati ve iş çıkışı bandı görünmez", async () => {
    stubDashboard({ profile: { dayPattern: null } });
    renderWithQuery(<DashboardPage />);
    expect(await screen.findByText("/ 1950 kcal")).toBeTruthy();
    expect(screen.queryByText(/Eve tahmini varış/)).toBeNull();
    expect(screen.queryByText(/İş Çıkışı &/)).toBeNull();
    expect(screen.queryByText(/Profilini tamamla/)).toBeNull();
  });

  it("istekler başarısız olsa da sayfa varsayılan hedeflerle açılır", async () => {
    restore = stubFetch([[/\/api\//, () => jsonResponse({ error: "Sunucu hatası" }, 500)]]).restore;
    renderWithQuery(<DashboardPage />);
    expect(await screen.findByText("/ 2000 kcal")).toBeTruthy();
    expect(screen.getByText("Henüz bugün için bir öğün kaydetmediniz")).toBeTruthy();
  });

  it("F15: takviye işareti anında değişir; sunucu 500 dönerse geri alınır ve hata gösterilir", async () => {
    let fail: (r: Response) => void = () => {};
    stubDashboard({ supplementPost: () => new Promise<Response>((resolve) => (fail = resolve)) });
    renderWithQuery(<DashboardPage />);
    const toggle = await screen.findByRole("button", { name: /Kreatin Monohidrat/ });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-pressed")).toBe("true"));

    await act(async () => fail(jsonResponse({ error: "Disk dolu" }, 500)));
    await waitFor(() => expect(toggle.getAttribute("aria-pressed")).toBe("false"));
    expect(screen.getByRole("alert").textContent).toContain("Disk dolu");
  });

  it("silinen öğün 'Geri Al' ile aynı makrolarla geri gönderilir", async () => {
    const s = stubDashboard();
    renderWithQuery(<DashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Tavuk Göğsü öğününü sil" }));
    const toast = await screen.findByRole("status");
    expect(toast.textContent).toContain("öğünlerden kaldırıldı");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Geri Al/ })));
    const post = s.calls.find((c) => c.url.includes("/api/food-logs") && c.init?.method === "POST");
    expect(JSON.parse(String(post?.init?.body))).toMatchObject({ grams: 123, caloriesSnapshot: 203, name: "Tavuk Göğsü" });
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
});
