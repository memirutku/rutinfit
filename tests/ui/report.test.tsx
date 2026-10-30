import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DietitianReportView } from "@/components/report/DietitianReportView";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  vi.restoreAllMocks();
});

const report = (from: string, to: string) => ({
  from,
  to,
  dayCount: 7,
  generatedAt: "2026-10-30T10:00:00.000Z",
  profile: { age: 35, sex: "female", heightCm: 165, currentWeightKg: 80, goalType: "lose", calorieTarget: 1800, proteinTargetG: 110, carbTargetG: 180, fatTargetG: 60, waterTargetMl: 2500, notes: "Laktoz intoleransı" },
  loggedDays: 2,
  daysOnTarget: 1,
  averages: { kcal: 1915, protein: 69, carbs: 20, fat: 10, waterMl: 1500 },
  weight: { start: 80.4, end: 79.6, change: -0.8 },
  training: { sessions: 0, cardioMin: 40 },
  days: [{ date: "2026-10-19", kcal: 1730, protein: 68, carbs: 20, fat: 10, waterMl: 1500, weightKg: 80.4, workouts: 0, cardioMin: 0, onTarget: true }],
  meals: [
    { date: "2026-10-19", mealType: "breakfast", mealLabel: "Kahvaltı", items: [{ time: "08:00", name: "Yulaf", grams: 60, kcal: 230, protein: 8 }] },
    { date: "2026-10-19", mealType: "dinner", mealLabel: "Akşam Yemeği", items: [{ time: "19:00", name: "Diyetisyen akşamı", grams: 0, kcal: 420, protein: 18 }] },
    { date: "2026-10-20", mealType: "breakfast", mealLabel: "Kahvaltı", items: [{ time: "08:30", name: "Yumurta", grams: 100, kcal: 155, protein: 13 }] },
  ],
  supplements: [{ name: "D Vitamini", dose: "1000 IU", takenDays: 1 }],
  targets: {
    kcal: { avg: 1915, target: 1800, diff: 115, diffPct: 6, status: "ok" },
    protein: { avg: 69, target: 110, diff: -41, diffPct: -37, status: "off" },
    carbs: { avg: 20, target: 180, diff: -160, diffPct: -89, status: "off" },
    fat: { avg: 10, target: 60, diff: -50, diffPct: -83, status: "off" },
  },
  measurements: [
    { key: "waistCm", label: "Bel", unit: "cm", first: { date: "2026-10-20", value: 93 }, last: { date: "2026-10-30", value: 91 }, change: -2, count: 3 },
    { key: "restingHr", label: "Dinlenik nabız", unit: "atım/dk", first: { date: "2026-10-30", value: 64 }, last: { date: "2026-10-30", value: 64 }, change: null, count: 1 },
    { key: "waistHipRatio", label: "Bel/kalça oranı", unit: "", first: { date: "2026-10-20", value: 0.86 }, last: { date: "2026-10-30", value: 0.85 }, change: -0.01, count: 2 },
  ],
  adherence: {
    overall: { planned: 3, marked: 3, done: 1, partial: 1, skipped: 1, percent: 50 },
    weeks: [{ weekStart: "2026-10-19", from: "2026-10-24", to: "2026-10-25", planned: 2, marked: 2, done: 1, partial: 1, skipped: 0, percent: 75 }],
  },
  planVsActual: [
    { date: "2026-10-19", mealType: "lunch", mealLabel: "Öğle Yemeği", planned: "Bulgur Pilavı", plannedKcal: 400, actualKcal: 600, actualCount: 1, diffKcal: 200, adherence: "partial" },
    { date: "2026-10-19", mealType: "extra", mealLabel: "Ekstra / Ara Öğün", planned: null, plannedKcal: null, actualKcal: 105, actualCount: 1, diffKcal: null, adherence: null },
  ],
});

describe("F77: diyetisyen raporu", () => {
  it("son 7 günü gösterir; 30 güne geçer; yazdırır; Excel indirir", async () => {
    const urls: string[] = [];
    restore = stubFetch([
      ["/api/reports/dietitian/xlsx", () =>
        new Response("xlsx", { headers: { "Content-Disposition": 'attachment; filename="rapor.xlsx"', "X-RutinFit-Export-Path": encodeURIComponent("/tmp/exports/rapor.xlsx") } })],
      ["/api/reports/dietitian", (url) => {
        urls.push(url);
        const p = new URL(url, "http://x").searchParams;
        return jsonResponse(report(p.get("from")!, p.get("to")!));
      }],
    ]).restore;
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});

    renderWithQuery(<DietitianReportView today="2026-10-30" />);
    expect(await screen.findByText("Beslenme ve aktivite raporu")).toBeTruthy();
    expect(urls[0]).toContain("from=2026-10-24&to=2026-10-30");
    expect(screen.getByText(/Laktoz intoleransı/)).toBeTruthy();
    const daily = screen.getByRole("region", { name: "Günlük tablo" });
    expect(within(daily).getByText("1.730")).toBeTruthy();
    expect(screen.getByText(/08:00 Yulaf · 60 g · 230 kcal/)).toBeTruthy();
    expect(screen.getByText(/D Vitamini \(1000 IU\): 1 gün/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Son 30 gün" }));
    await waitFor(() => expect(urls.at(-1)).toContain("from=2026-10-01&to=2026-10-30"));

    const printButton = screen.getByRole("button", { name: /Yazdır \/ PDF/ }) as HTMLButtonElement;
    await waitFor(() => expect(printButton.disabled).toBe(false));
    fireEvent.click(printButton);
    await waitFor(() => expect(print).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Excel indir/ }));
    expect(await screen.findByText(/Excel indirildi: rapor.xlsx \(İndirilenler klasörü\)/)).toBeTruthy();
    // B36: ham yol yerine Finder düğmesi.
    expect(screen.getByRole("button", { name: "İndirilen Excel dosyasını Finder'da göster" })).toBeTruthy();
  });
});

describe("B43: diyetisyenin baktığı bölümler", () => {
  function setup() {
    restore = stubFetch([["/api/reports/dietitian", (url) => {
      const p = new URL(url, "http://x").searchParams;
      return jsonResponse(report(p.get("from")!, p.get("to")!));
    }]]).restore;
    renderWithQuery(<DietitianReportView today="2026-10-30" />);
  }

  it("özet kartları hedeften sapmayı renk ve sözle gösterir", async () => {
    setup();
    const summary = await screen.findByRole("region", { name: "Özet" });
    const kcal = within(summary).getByRole("group", { name: "Ort. kalori" });
    expect(kcal.getAttribute("data-status")).toBe("ok");
    expect(kcal.textContent).toContain("Hedefe uygun");
    expect(kcal.textContent).toContain("+115 kcal (hedefin %6 üstünde)");
    const protein = within(summary).getByRole("group", { name: "Ort. protein" });
    expect(protein.getAttribute("data-status")).toBe("off");
    expect(protein.textContent).toContain("Hedeften sapma");
    expect(protein.textContent).toContain("-41 g (hedefin %37 altında)");
    expect(within(summary).getByRole("group", { name: "Plana uyum" }).textContent).toContain("%50");
  });

  it("ölçü tablosu ilk, son ve farkı gösterir", async () => {
    setup();
    const table = await screen.findByRole("region", { name: "Vücut ölçüleri" });
    const waist = within(table).getByRole("row", { name: /^Bel \d/ });
    expect(waist.textContent).toContain("93 cm");
    expect(waist.textContent).toContain("91 cm");
    expect(waist.textContent).toContain("-2 cm");
    expect(within(table).getByRole("row", { name: /Dinlenik nabız/ }).textContent).toContain("—");
    const ratio = within(table).getByRole("row", { name: /Bel\/kalça oranı/ });
    expect(ratio.textContent).toContain("0,86");
    expect(ratio.textContent).toContain("-0,01");
  });

  it("haftalık uyum ve öğün bazında plan–gerçekleşen tabloları", async () => {
    setup();
    const weeks = await screen.findByRole("region", { name: "Plana uyum" });
    expect(within(weeks).getByRole("row", { name: /24\.10/ }).textContent).toContain("%75");
    const pva = screen.getByRole("region", { name: "Plan ve gerçekleşen" });
    const lunch = within(pva).getByRole("row", { name: /Bulgur Pilavı/ });
    expect(lunch.textContent).toContain("400");
    expect(lunch.textContent).toContain("600");
    expect(lunch.textContent).toContain("+200");
    expect(lunch.textContent).toContain("Kısmen");
    expect(within(pva).getByRole("row", { name: /Ekstra/ }).textContent).toContain("Plan dışı");
  });

  it("öğün günlüğü güne göre gruplanır; günün toplamı başlıkta yazar; bilinmeyen gram yazılmaz", async () => {
    setup();
    const log = await screen.findByRole("region", { name: "Öğün günlüğü" });
    const day1 = within(log).getByRole("group", { name: /19\.10/ });
    expect(within(day1).getByRole("heading").textContent).toMatch(/19\.10 Pazartesi · 1\.730 kcal/);
    expect(day1.textContent).toContain("Kahvaltı");
    expect(day1.textContent).toContain("Akşam Yemeği");
    expect(day1.textContent).toContain("19:00 Diyetisyen akşamı · 420 kcal");
    const day2 = within(log).getByRole("group", { name: /20\.10/ });
    expect(day2.textContent).toContain("Yumurta");
    expect(day2.textContent).not.toContain("Yulaf");
  });
});
