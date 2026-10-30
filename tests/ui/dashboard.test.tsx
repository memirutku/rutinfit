import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/page";
import { getRhythmStep } from "@/components/dashboard/rhythm";
import { RhythmStepCard } from "@/components/dashboard/RhythmStepCard";
import { CeilingAlert } from "@/components/dashboard/CeilingAlert";
import { CalorieCard } from "@/components/dashboard/CalorieCard";
import { MacroBalanceCard } from "@/components/dashboard/MacroBalanceCard";
import { TodayWorkoutCard } from "@/components/dashboard/TodayWorkoutCard";
import { TodayMealsList, dashboardMealLabel } from "@/components/dashboard/TodayMealsList";
import { WellbeingCard, toWellbeingValues } from "@/components/dashboard/WellbeingCard";
import { getLocalDateString } from "@/lib/date-utils";
import type { DailySummary, FoodLog, FoodLogsResponse } from "@/lib/schemas/food";
import type { ProgressResponse } from "@/lib/schemas/progress";
import type { WorkoutTemplate } from "@/lib/schemas/workout";
import { jsonResponse, stubFetch } from "../helpers/fetch";
import { renderWithQuery } from "../helpers/query";

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  restore = undefined;
});

const today = getLocalDateString();
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
    [8, "Sabah Rutini & Hidrasyon", { kind: "creatine" }],
    [13, "Öğle Beslenmesi & Odak", { kind: "quickAdd", mealType: "lunch" }],
    [17, "İş Çıkışı & Antrenman Hazırlığı", { kind: "quickAdd", mealType: "workSnack" }],
    [20, "Toparlanma & Akşam Yemeği", { kind: "quickAdd", mealType: "dinner" }],
    [23, "Gece Kapanışı & Kaliteli Uyku", { kind: "scrollToWellbeing" }],
  ])("saat %i → %s", (hour, title, action) => {
    const step = getRhythmStep(hour, "20:00");
    expect(step.title).toBe(title);
    expect(step.action).toEqual(action);
  });

  it("eve varış saatini ve kreatin durumunu metne yansıtır", () => {
    expect(getRhythmStep(17, "20:00").time).toBe("17:00 - 20:00");
    expect(getRhythmStep(20, "20:00").time).toBe("20:00 - 21:30");
    expect(getRhythmStep(8, "19:30", false).actionText).toBe("Kreatin İşaretle");
    expect(getRhythmStep(8, "19:30", true).actionText).toBe("Kreatin Alındı ✓");
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

  it("F56: sayıları gizleme modunda kalori, makro ve öğün sayıları görünmez; ilerleme sözle anlatılır", () => {
    const { container: cal } = render(<CalorieCard summary={summary()} targets={targets} hideNumbers />);
    expect(cal.textContent).not.toMatch(/\d+\s*kcal/);
    expect(cal.textContent).toMatch(/Güne başladın|Hedefe yaklaşıyorsun|Hedefe ulaştın|Tavanın üzerindesin/);

    const { container: macros } = render(<MacroBalanceCard summary={summary()} targets={targets} hideNumbers />);
    expect(macros.textContent).not.toMatch(/\d+g/);
    expect(macros.textContent).toContain("Protein");

    const { container: meals } = render(<TodayMealsList logs={[log()]} onAdd={vi.fn()} onDelete={vi.fn()} hideNumbers />);
    expect(meals.textContent).not.toMatch(/kcal/);

    const { container: alert } = render(
      <CeilingAlert alert={{ isApproaching: true, isExceeded: true, diffFromCeiling: -50, message: "Tavanı 50 kcal aştın" }} hideNumbers />
    );
    expect(alert.textContent).not.toMatch(/\d/);
  });

  it("TodayWorkoutCard bekleyen ve tamamlanan seansı ayırır; şablon yoksa dinlenme günüdür", () => {
    const { rerender } = render(<TodayWorkoutCard template={template} isCompleted={false} />);
    expect(screen.getByText("Ağırlık A")).toBeTruthy();
    expect(screen.getByText("Bekliyor")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Hafiflet" })).toBeTruthy();
    rerender(<TodayWorkoutCard template={template} isCompleted />);
    expect(screen.getByText("Tamamlandı ✓")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Seansı Gör/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Hafiflet" })).toBeNull();
    rerender(<TodayWorkoutCard isCompleted={false} />);
    expect(screen.getByText("Dinlenme & Toparlanma")).toBeTruthy();
  });

  it("TodayMealsList boş durumu ve silme düğmesi", () => {
    const onDelete = vi.fn();
    const onAdd = vi.fn();
    const { rerender } = render(<TodayMealsList logs={[]} onAdd={onAdd} onDelete={onDelete} />);
    expect(screen.getByText("Henüz bugün için bir öğün kaydetmediniz")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Öğün Ekle/ }));
    expect(onAdd).toHaveBeenCalled();

    const l = log({ mealType: "workSnack" });
    rerender(<TodayMealsList logs={[l]} onAdd={onAdd} onDelete={onDelete} />);
    expect(screen.getByText("İş Çıkışı")).toBeTruthy();
    expect(screen.getByText(/123g · 203 kcal · P: 38g · K: 0g · Y: 4.4g/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tavuk Göğsü öğününü sil" }));
    expect(onDelete).toHaveBeenCalledWith(l);
  });

  it("öğün etiketleri ana panelin kısa adlarını kullanır", () => {
    expect(["breakfast", "lunch", "workSnack", "dinner", "extra", "snack"].map(dashboardMealLabel)).toEqual([
      "Kahvaltı",
      "Öğle Yemeği",
      "İş Çıkışı",
      "Akşam Yemeği",
      "Ara Öğün",
      "Ara Öğün",
    ]);
  });
});

describe("WellbeingCard", () => {
  it("form değerlerini kayıt gövdesine çevirir", () => {
    expect(toWellbeingValues("112,5", "7,5", 4)).toEqual({ weightKg: 112.5, energy1to5: 4, sleepMinutes: 450 });
    expect(toWellbeingValues("", "", 3)).toEqual({ weightKg: undefined, energy1to5: 3, sleepMinutes: 420 });
  });

  it("sunucu değerleriyle dolar; aynı veri tekrar gelince yazılanı ezmez, değişince yeniden dolar", () => {
    const props = { onToggleCreatine: vi.fn(), onSave: vi.fn() };
    const { rerender } = render(<WellbeingCard today={progress(false).today} {...props} />);
    const weight = screen.getByLabelText("Sabah Kilosu (kg)") as HTMLInputElement;
    expect(weight.value).toBe("110.5");
    expect((screen.getByLabelText("Uyku (saat)") as HTMLInputElement).value).toBe("7.5");
    expect(screen.getByText("4 / 5")).toBeTruthy();

    fireEvent.change(weight, { target: { value: "109" } });
    // Kreatin değişti, iyilik hali aynı: kullanıcının yazdığı korunur.
    rerender(<WellbeingCard today={progress(true).today} {...props} />);
    expect(weight.value).toBe("109");

    rerender(<WellbeingCard today={{ ...progress(true).today, weightKg: 108.2 }} {...props} />);
    expect(weight.value).toBe("108.2");
  });

  it("kreatin düğmesi durumu aria-pressed ile bildirir", () => {
    const onToggleCreatine = vi.fn();
    const { rerender } = render(<WellbeingCard today={progress(false).today} onToggleCreatine={onToggleCreatine} onSave={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "5g Kreatin Alındı" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(onToggleCreatine).toHaveBeenCalled();
    rerender(<WellbeingCard today={progress(true).today} onToggleCreatine={onToggleCreatine} onSave={vi.fn()} />);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("kayıt başarılıysa onay gösterir, başarısızsa göstermez", async () => {
    const onSave = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    render(<WellbeingCard today={progress(false).today} onToggleCreatine={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Kaydet" })));
    expect(onSave).toHaveBeenLastCalledWith({ weightKg: 110.5, energy1to5: 2, sleepMinutes: 450 });
    expect(screen.getByText("Kayıt güncellendi ✓")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Kaydet" })));
    expect(screen.queryByText("Kayıt güncellendi ✓")).toBeNull();
  });
});

describe("DashboardPage", () => {
  function stubDashboard(opts: { progressPost?: () => Response | Promise<Response>; logs?: FoodLog[] } = {}) {
    let taken = false;
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
      ["/api/profile", () => jsonResponse({ workdayHomeTime: "20:15" })],
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

  it("istekler başarısız olsa da sayfa varsayılan hedeflerle açılır", async () => {
    restore = stubFetch([[/\/api\//, () => jsonResponse({ error: "Sunucu hatası" }, 500)]]).restore;
    renderWithQuery(<DashboardPage />);
    expect(await screen.findByText("/ 2080 kcal")).toBeTruthy();
    expect(screen.getByText("Henüz bugün için bir öğün kaydetmediniz")).toBeTruthy();
  });

  it("kreatin işareti anında değişir; sunucu 500 dönerse geri alınır ve hata gösterilir", async () => {
    let fail: (r: Response) => void = () => {};
    stubDashboard({ progressPost: () => new Promise<Response>((resolve) => (fail = resolve)) });
    renderWithQuery(<DashboardPage />);
    const toggle = await screen.findByRole("button", { name: "5g Kreatin Alındı" });
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
