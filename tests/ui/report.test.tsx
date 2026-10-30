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
  meals: [{ date: "2026-10-19", mealType: "breakfast", mealLabel: "Kahvaltı", items: [{ time: "08:00", name: "Yulaf", grams: 60, kcal: 230, protein: 8 }] }],
  supplements: [{ name: "D Vitamini", dose: "1000 IU", takenDays: 1 }],
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
    expect(await screen.findByText(/Excel indirildi: rapor.xlsx/)).toBeTruthy();
  });
});
