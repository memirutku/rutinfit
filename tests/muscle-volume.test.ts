import { describe, expect, it } from "vitest";
import { MUSCLE_GROUPS } from "@/lib/muscles";
import { volumeStatus, weeklyMuscleSets, VOLUME_TARGET } from "@/lib/muscle-volume";

describe("F24: kas grubu başına haftalık set", () => {
  const sessions = [
    { date: "2026-10-27", completed: true, setLogs: [{ exerciseName: "Bench Press" }, { exerciseName: "Bench Press" }, { exerciseName: "Squat" }] },
    { date: "2026-10-29", completed: true, setLogs: [{ exerciseName: "Incline Dumbbell Press" }] },
    { date: "2026-10-20", completed: true, setLogs: [{ exerciseName: "bench press (barbell)" }] },
    { date: "2026-10-28", completed: false, setLogs: [{ exerciseName: "Bench Press" }] },
  ];

  it("son N haftayı Pazartesi'den başlatır; tamamlanmamış seans sayılmaz; yazım farkı eşleşir", () => {
    const r = weeklyMuscleSets(sessions, MUSCLE_GROUPS, "2026-10-30", 2);
    expect(r.weeks).toEqual(["2026-10-19", "2026-10-26"]);
    const chest = r.rows.find((m) => m.muscleId === "chest")!;
    expect(chest.sets).toEqual([1, 3]);
    expect(r.rows.find((m) => m.muscleId === "quads")!.sets).toEqual([0, 1]);
  });

  it("hedef aralığı 10–20 set: az / hedefte / fazla", () => {
    expect(VOLUME_TARGET).toEqual({ min: 10, max: 20 });
    expect([0, 9, 10, 20, 21].map(volumeStatus)).toEqual(["low", "low", "ok", "ok", "high"]);
  });

  it("kas tanımları benzersiz ve her birinde egzersiz var", () => {
    expect(new Set(MUSCLE_GROUPS.map((m) => m.muscleId)).size).toBe(MUSCLE_GROUPS.length);
    expect(MUSCLE_GROUPS.every((m) => m.exercises.length > 0)).toBe(true);
  });
});
