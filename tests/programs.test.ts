import { describe, expect, it } from "vitest";
import { PROGRAMS, cycleTrainingMax, wendlerFeedback, trainingMaxFrom1Rm, wendlerPlan, wendlerSets, WENDLER_WEEKS } from "@/lib/programs";
import { findExercise } from "@/lib/exercise-library";
import { TemplateInputSchema } from "@/lib/schemas/workout";

describe("F18: hazır programlar", () => {
  it("3–5 program; her şablon API şemasından geçer; günler program içinde benzersiz", () => {
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(3);
    expect(PROGRAMS.length).toBeLessThanOrEqual(6);
    expect(new Set(PROGRAMS.map((p) => p.id)).size).toBe(PROGRAMS.length);
    for (const p of PROGRAMS) {
      const days = p.templates.map((t) => t.dayOfWeek);
      expect(new Set(days).size, p.id).toBe(days.length);
      expect(p.templates.length, p.id).toBe(p.daysPerWeek);
      for (const t of p.templates) expect(TemplateInputSchema.safeParse(t).success, `${p.id} ${t.name}`).toBe(true);
    }
  });

  it("bütün egzersizler kütüphanede var (ipucu ve benzerleri çalışır)", () => {
    const missing = PROGRAMS.flatMap((p) => p.templates.flatMap((t) => t.exercises.map((e) => e.exerciseName))).filter((n) => !findExercise(n));
    expect(missing).toEqual([]);
  });

  it("en az bir program ekipmansız (ev) ve en az biri yürüyüş içeriyor", () => {
    expect(PROGRAMS.some((p) => p.place === "Ev" && p.id.includes("vucut-agirligi"))).toBe(true);
    expect(PROGRAMS.some((p) => p.templates.some((t) => t.type === "easy_run"))).toBe(true);
  });
});

describe("B21: 5/3/1 (Wendler) %1RM'e bağlı yükleme", () => {
  const wendler = PROGRAMS.find((p) => p.id === "wendler-531")!;

  it("ileri seviye program; dört ana kaldırış 5/3/1 yüklemeli, ilk hareket olarak", () => {
    expect(wendler).toBeDefined();
    expect(wendler.level).toBe("İleri");
    expect(wendler.oneRepMaxLifts).toEqual(["Overhead Press", "Deadlift", "Bench Press", "Squat"]);
    for (const t of wendler.templates) {
      const main = t.exercises[0];
      expect(main.loadingScheme, t.name).toBe("531");
      expect(main.targetSets).toBe(3);
      expect(t.exercises.slice(1).every((e) => !e.loadingScheme)).toBe(true);
    }
    // Döngü sonunda alt vücut 5 kg, üst vücut 2,5 kg artar.
    const inc = Object.fromEntries(wendler.templates.map((t) => [t.exercises[0].exerciseName, t.exercises[0].incrementKg]));
    expect(inc).toEqual({ "Overhead Press": 2.5, Deadlift: 5, "Bench Press": 2.5, Squat: 5 });
    expect(PROGRAMS.filter((p) => p.id !== "wendler-531").every((p) => p.level !== "İleri")).toBe(true);
  });

  it("antrenman maksimumu 1RM'in %90'ı, 2,5 kg'a aşağı yuvarlanır", () => {
    expect(trainingMaxFrom1Rm(100)).toBe(90);
    expect(trainingMaxFrom1Rm(140)).toBe(125); // 126 → 125
    expect(trainingMaxFrom1Rm(116.7)).toBe(105);
    expect(trainingMaxFrom1Rm(0)).toBeNull();
    expect(trainingMaxFrom1Rm(Number.NaN)).toBeNull();
  });

  it("haftalık yüzdeler ve tekrarlar; son set AMRAP (deload hariç)", () => {
    expect(WENDLER_WEEKS).toHaveLength(4);
    expect(wendlerSets(100, 1)).toEqual([
      { percent: 65, weightKg: 65, reps: 5, amrap: false },
      { percent: 75, weightKg: 75, reps: 5, amrap: false },
      { percent: 85, weightKg: 85, reps: 5, amrap: true },
    ]);
    expect(wendlerSets(117.5, 3).map((s) => [s.weightKg, s.reps, s.amrap])).toEqual([
      [87.5, 5, false],
      [100, 3, false],
      [112.5, 1, true],
    ]);
    expect(wendlerSets(100, 4).map((s) => [s.weightKg, s.reps, s.amrap])).toEqual([
      [40, 5, false],
      [50, 5, false],
      [60, 5, false],
    ]);
    expect(wendlerSets(100, 9).map((s) => s.weightKg)).toEqual([65, 75, 85]); // geçersiz hafta → 1
  });

  it("hafta ve döngü tamamlanan seans sayısından gelir; döngü başına TM artar", () => {
    expect(wendlerPlan(0)).toEqual({ week: 1, cycle: 0 });
    expect(wendlerPlan(3)).toEqual({ week: 4, cycle: 0 });
    expect(wendlerPlan(4)).toEqual({ week: 1, cycle: 1 });
    expect(wendlerPlan(9)).toEqual({ week: 2, cycle: 2 });
    expect(cycleTrainingMax(100, 2, 2.5)).toBe(105);
  });
});

describe("B21: 5/3/1 ilerleme mesajı", () => {
  it("set yoksa bilgi döner", () => {
    expect(wendlerFeedback([], 2.5)).toMatchObject({ badge: "info", currentMaxWeight: 0 });
  });
});
