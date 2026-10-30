import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdaptiveTdeeCard } from "@/components/progress/AdaptiveTdeeCard";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

describe("F10 + F57: adaptif TDEE kartı", () => {
  it("tahmini, güveni, öneriyi ve neye dayandığını gösterir", async () => {
    restore = stubFetch([
      [
        "/api/progress/adaptive-tdee",
        () =>
          jsonResponse({
            ok: true,
            tdee: 2550,
            confidence: "high",
            avgIntake: 2000,
            weightChangeKgPerWeek: -0.5,
            loggedDays: 21,
            windowDays: 21,
            weighIns: 21,
            from: "2026-10-09",
            to: "2026-10-29",
            weights: [{ date: "2026-10-09", kg: 101.5 }, { date: "2026-10-29", kg: 100 }],
            formulaTdee: 2800,
            currentTarget: 2300,
            suggestion: { calorieTarget: 2000, delta: -300, reason: "Haftada 0,5 kg kayıp için" },
          }),
      ],
    ]).restore;
    renderWithQuery(<AdaptiveTdeeCard />);
    expect(await screen.findByText("2.550 kcal")).toBeTruthy();
    expect(screen.getByText(/Yüksek güven/)).toBeTruthy();
    expect(screen.getByText(/formül 2.800 kcal/)).toBeTruthy();
    expect(screen.getByText("2.000 kcal", { selector: "strong" })).toBeTruthy();
    // F57: açıklama
    expect(screen.getByText("Bu tahmin neye dayanıyor?")).toBeTruthy();
    expect(screen.getByText("Ortalama alım")).toBeTruthy();
    expect(screen.getByText("2.000 kcal (21/21 gün kayıtlı)")).toBeTruthy();
    expect(screen.getByText("−0,5 kg / hafta (21 tartı)")).toBeTruthy();
  });

  it("yetersiz veride ne gerektiğini söyler", async () => {
    restore = stubFetch([["/api/progress/adaptive-tdee", () => jsonResponse({ ok: false, reason: "En az 14 günlük kayıt gerekir (şu an 3 gün)." })]]).restore;
    renderWithQuery(<AdaptiveTdeeCard />);
    expect(await screen.findByText(/En az 14 günlük kayıt gerekir/)).toBeTruthy();
  });
});
