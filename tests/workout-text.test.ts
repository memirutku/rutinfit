import { describe, expect, it } from "vitest";
import { parseWorkoutText } from "@/lib/workout-text";

const sets = (text: string) => parseWorkoutText(text).sets.map((s) => [s.exerciseName, s.setNumber, s.weightKg, s.reps, s.rpe ?? null]);

describe("F28: metinden antrenman", () => {
  it("set×tekrar ve ağırlık; adı kütüphanedeki kanonik ada çevirir", () => {
    expect(sets("squat 3x8 80 kg")).toEqual([
      ["Squat", 1, 80, 8, null],
      ["Squat", 2, 80, 8, null],
      ["Squat", 3, 80, 8, null],
    ]);
  });

  it("farklı yazımlar: 3 x 5 @ 62,5kg · 80kg 2x6 · 3x8x60 · rpe", () => {
    expect(sets("bench press 3 x 5 @ 62,5kg").map((s) => s[2])).toEqual([62.5, 62.5, 62.5]);
    expect(sets("deadlift 140kg 2x5 rpe 8,5")).toEqual([
      ["Deadlift", 1, 140, 5, 8.5],
      ["Deadlift", 2, 140, 5, 8.5],
    ]);
    expect(sets("barbell row 3x8x60").map((s) => [s[2], s[3]])).toEqual([[60, 8], [60, 8], [60, 8]]);
  });

  it("ağırlık×tekrar listesi; virgülden sonraki parçalar aynı egzersizi sürdürür", () => {
    expect(sets("squat 100x5, 100x5, 105x3")).toEqual([
      ["Squat", 1, 100, 5, null],
      ["Squat", 2, 100, 5, null],
      ["Squat", 3, 105, 3, null],
    ]);
  });

  it("Türkçe adlar ve vücut ağırlığı; satırlar ve noktalı virgül ayrı egzersizdir", () => {
    const r = parseWorkoutText("şınav 3x15\nplank 2x45; lat pulldown 3x10-12 50");
    expect(r.sets.map((s) => [s.exerciseName, s.weightKg, s.reps])).toEqual([
      ["Pushup", 0, 15],
      ["Pushup", 0, 15],
      ["Pushup", 0, 15],
      ["Plank", 0, 45],
      ["Plank", 0, 45],
      ["Lat Pulldown", 50, 10],
      ["Lat Pulldown", 50, 10],
      ["Lat Pulldown", 50, 10],
    ]);
  });

  it("anlaşılmayan satırı ve kütüphanede olmayan adı bildirir", () => {
    const r = parseWorkoutText("bugün harikaydı\nzercher squat 3x5 60");
    expect(r.lines[0]).toMatchObject({ ok: false });
    expect(r.lines[1]).toMatchObject({ ok: true, inLibrary: false, exerciseName: "Zercher Squat" });
    expect(r.sets).toHaveLength(3);
  });
});
