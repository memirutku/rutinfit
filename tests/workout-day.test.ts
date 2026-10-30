import { describe, expect, it } from "vitest";
import { describeTemplate, sessionMatchesTemplate, todayWorkoutStatus, weekdayOf } from "@/lib/workout-day";
import type { WorkoutSession, WorkoutTemplate } from "@/lib/schemas/workout";

const ex = (exerciseName: string, targetSets: number) => ({ id: exerciseName, exerciseName, targetSets, repMin: 6, repMax: 8, restSeconds: 90, orderIndex: 0 });
const tpl = (over: Partial<WorkoutTemplate>): WorkoutTemplate => ({
  id: "t",
  name: "T",
  type: "strength",
  dayOfWeek: 5,
  targetDurationMinutes: 60,
  notes: null,
  exercises: [],
  ...over,
});
const session = (over: Partial<WorkoutSession>): WorkoutSession => ({
  id: "s",
  date: "2026-10-30",
  templateId: null,
  name: "S",
  durationMinutes: 60,
  rpe: 7,
  notes: null,
  completed: true,
  setLogs: [],
  ...over,
});

const upperA = tpl({ id: "ua", name: "Üst Gövde A", dayOfWeek: 1, exercises: [ex("Bench Press", 4), ex("Barbell Row", 4), ex("Overhead Press", 3), ex("Lat Pulldown", 3), ex("Tricep Pushdown", 2)] });
const lowerB = tpl({ id: "lb", name: "Alt Gövde B", dayOfWeek: 5, exercises: [ex("Deadlift", 3), ex("Leg Press", 3)] });

describe("B20: gün ve şablon yardımcıları", () => {
  it("weekdayOf saat diliminden bağımsız 1–7 döner", () => {
    expect(weekdayOf("2026-10-26")).toBe(1);
    expect(weekdayOf("2026-10-30")).toBe(5);
    expect(weekdayOf("2026-11-01")).toBe(7);
  });

  it("gün açıklaması şablondan üretilir; antrenman gününe 'Toparlanma' yazılmaz", () => {
    const text = describeTemplate(upperA);
    expect(text).not.toMatch(/toparlanma/i);
    expect(text).toBe("5 hareket · 16 set: Bench Press, Barbell Row, Overhead Press ve 2 hareket daha");
    expect(describeTemplate(lowerB)).toBe("2 hareket · 6 set: Deadlift, Leg Press");
    expect(describeTemplate({ ...upperA, notes: "Kendi notum" })).toBe("Kendi notum");
    expect(describeTemplate(tpl({ type: "easy_run", targetDurationMinutes: 30 }))).toMatch(/30 dk kolay tempo/);
    expect(describeTemplate(tpl({ type: "rest" }))).toMatch(/Dinlenme/);
    expect(describeTemplate(undefined)).toMatch(/Dinlenme/);
    expect(describeTemplate(tpl({ exercises: [] }))).toMatch(/Hareket eklenmemiş/);
  });

  it("seans şablonla kimliğinden, kimlik yoksa adından eşleşir", () => {
    expect(sessionMatchesTemplate(session({ templateId: "ua" }), upperA)).toBe(true);
    expect(sessionMatchesTemplate(session({ templateId: "lb" }), upperA)).toBe(false);
    expect(sessionMatchesTemplate(session({ name: "üst gövde a" }), upperA)).toBe(true);
    expect(sessionMatchesTemplate(session({ name: "Serbest" }), upperA)).toBe(false);
  });

  it("Mert: bugün Alt Gövde B günü, yapılan Üst Gövde A ise plan 'bekliyor', yapılan ayrıca gösterilir", () => {
    const status = todayWorkoutStatus([upperA, lowerB], [session({ templateId: "ua", name: "Üst Gövde A" })], "2026-10-30");
    expect(status.planned?.name).toBe("Alt Gövde B");
    expect(status.completed).toBe(false);
    expect(status.doneOther.map((s) => s.name)).toEqual(["Üst Gövde A"]);
  });

  it("bugünün şablonu yapıldıysa tamamlandı; aynı güne iki şablon varsa yapılan seçilir", () => {
    const lowerB2 = tpl({ id: "lb2", name: "Kardiyo", dayOfWeek: 5 });
    const done = todayWorkoutStatus([upperA, lowerB, lowerB2], [session({ templateId: "lb2" }), session({ date: "2026-10-29", templateId: "lb" })], "2026-10-30");
    expect(done.planned?.id).toBe("lb2");
    expect(done.completed).toBe(true);
    expect(done.doneOther).toEqual([]);
  });

  it("tamamlanmamış ya da başka günün seansı sayılmaz; şablonsuz günde planned yoktur", () => {
    const s = todayWorkoutStatus([lowerB], [session({ templateId: "lb", completed: false }), session({ templateId: "lb", date: "2026-10-23" })], "2026-10-30");
    expect(s.completed).toBe(false);
    expect(s.doneOther).toEqual([]);
    const rest = todayWorkoutStatus([upperA], [session({ name: "Serbest" })], "2026-10-30");
    expect(rest.planned).toBeUndefined();
    expect(rest.doneOther.map((x) => x.name)).toEqual(["Serbest"]);
  });
});
