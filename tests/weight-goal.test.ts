import { describe, expect, it } from "vitest";
import { weightGoalProgress } from "@/lib/weight-goal";

const base = { startKg: 90, targetKg: 75, goalType: "lose" as const, rateKgPerWeek: 0.5, today: "2026-10-30" };

describe("B07: kilo hedefine ilerleme", () => {
  it("verilen ve kalan kg, yüzde ve tahmini varış tarihini hesaplar (7 günlük ortalama esas)", () => {
    const p = weightGoalProgress({ ...base, latest: { weightKg: 87.6, rollingAvg: 88 } })!;
    expect(p).toMatchObject({ currentKg: 88, changedKg: 2, remainingKg: 13, percent: 13, weeksLeft: 26, etaDate: "2027-04-30", reached: false });
  });

  it("tartı yoksa başlangıç kilosundan hesaplar", () => {
    expect(weightGoalProgress({ ...base, latest: null })).toMatchObject({ currentKg: 90, changedKg: 0, remainingKg: 15, percent: 0 });
  });

  it("hedefe ulaşınca kalan 0 ve 'reached'", () => {
    expect(weightGoalProgress({ ...base, latest: { weightKg: 74.8, rollingAvg: 74.9 } })).toMatchObject({ remainingKg: 0, percent: 100, reached: true, etaDate: null });
  });

  it("kilo alma hedefinde yön tersine döner; ters yönde gidiş eksi değişim olarak görünür", () => {
    const gain = { startKg: 60, targetKg: 64, goalType: "gain" as const, rateKgPerWeek: 0.25, today: "2026-10-30" };
    expect(weightGoalProgress({ ...gain, latest: { weightKg: 61, rollingAvg: 61 } })).toMatchObject({ changedKg: 1, remainingKg: 3, percent: 25, weeksLeft: 12 });
    expect(weightGoalProgress({ ...gain, latest: { weightKg: 59.5, rollingAvg: 59.5 } })).toMatchObject({ changedKg: -0.5, remainingKg: 4.5, percent: 0 });
  });

  it("korumada ya da hedef kilo yoksa null (kart gösterilmez)", () => {
    expect(weightGoalProgress({ ...base, goalType: "maintain", latest: null })).toBeNull();
    expect(weightGoalProgress({ ...base, targetKg: null, latest: null })).toBeNull();
  });
});
