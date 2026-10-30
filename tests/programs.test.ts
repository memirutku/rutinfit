import { describe, expect, it } from "vitest";
import { PROGRAMS } from "@/lib/programs";
import { findExercise } from "@/lib/exercise-library";
import { TemplateInputSchema } from "@/lib/schemas/workout";

describe("F18: hazır programlar", () => {
  it("3–5 program; her şablon API şemasından geçer; günler program içinde benzersiz", () => {
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(3);
    expect(PROGRAMS.length).toBeLessThanOrEqual(5);
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
