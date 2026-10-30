import { describe, expect, it } from "vitest";
import { alternativesFor, EXERCISE_LIBRARY, findExercise, muscleGroupsWithLibrary, searchExercises } from "@/lib/exercise-library";
import { MUSCLE_GROUPS } from "@/lib/muscles";
import { weeklyMuscleSets } from "@/lib/muscle-volume";

describe("F25: egzersiz kütüphanesi", () => {
  it("kimlik ve adlar benzersiz; kaslar tanımlı; her egzersizde en az bir ipucu", () => {
    const muscles = new Set(MUSCLE_GROUPS.map((m) => m.muscleId));
    expect(new Set(EXERCISE_LIBRARY.map((e) => e.id)).size).toBe(EXERCISE_LIBRARY.length);
    expect(new Set(EXERCISE_LIBRARY.map((e) => e.name.toLowerCase())).size).toBe(EXERCISE_LIBRARY.length);
    for (const e of EXERCISE_LIBRARY) {
      expect(muscles.has(e.primary), e.name).toBe(true);
      expect(e.secondary.every((m) => muscles.has(m)), e.name).toBe(true);
      expect(e.cues.length, e.name).toBeGreaterThan(0);
    }
    expect(EXERCISE_LIBRARY.length).toBeGreaterThanOrEqual(50);
  });

  it("yazım farkı ve Türkçe adla bulur", () => {
    expect(findExercise("bench press (barbell)")?.id).toBe("bench-press");
    expect(findExercise("Şınav")?.id).toBe("pushup");
    expect(findExercise("Zumba")).toBeUndefined();
  });

  it("benzeriyle değiştir: aynı ana kas, kendisi hariç; ekipmanla süzülebilir", () => {
    const bench = findExercise("Bench Press")!;
    const alts = alternativesFor(bench);
    expect(alts.length).toBeGreaterThan(2);
    expect(alts.every((a) => a.primary === "chest" && a.id !== "bench-press")).toBe(true);
    expect(alternativesFor(bench, EXERCISE_LIBRARY, ["bodyweight"]).map((a) => a.id)).toEqual(["pushup"]);
  });

  it("arama Türkçe karakter gerektirmez; kas ve ekipmanla süzer", () => {
    expect(searchExercises(EXERCISE_LIBRARY, { search: "sinav" }).map((e) => e.id)).toContain("pushup");
    expect(searchExercises(EXERCISE_LIBRARY, { muscle: "hamstrings", equipment: "machine" }).map((e) => e.id)).toEqual(["leg-curl"]);
  });

  it("kütüphaneyle genişleyen kas grupları şablon adlarını doğru kasa sayar", () => {
    const groups = muscleGroupsWithLibrary();
    const r = weeklyMuscleSets([{ date: "2026-10-28", completed: true, setLogs: [{ exerciseName: "Cable Pushdown" }] }], groups, "2026-10-30", 1);
    expect(r.rows.find((m) => m.muscleId === "triceps")!.sets).toEqual([1]);
  });
});
