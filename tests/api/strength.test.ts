import { beforeEach, describe, expect, it } from "vitest";
import { GET as strength } from "@/app/api/progress/strength/route";
import { GET as volume } from "@/app/api/progress/volume/route";
import { prisma } from "@/lib/prisma";
import { getLocalDateString, addDaysToDateString } from "@/lib/date-utils";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

async function session(date: string, sets: Array<[string, number, number] | [string, number, number, string]>, completed = true) {
  return prisma.workoutSession.create({
    data: {
      date,
      name: "A",
      completed,
      setLogs: {
        create: sets.map(([exerciseName, weightKg, reps, setType], i) => ({ exerciseName, weightKg, reps, setNumber: i + 1, setType: setType ?? "normal" })),
      },
    },
  });
}

describe("GET /api/progress/strength", () => {
  it("F23: egzersiz listesi son kullanıma göre; yazım farkı tek egzersiz sayılır; planlanmış seans sayılmaz", async () => {
    await session("2026-10-01", [["Bench Press", 80, 8]]);
    await session("2026-10-08", [["bench press", 85, 6], ["Squat", 100, 5]]);
    await session("2026-10-20", [["Deadlift", 200, 1]], false);
    const res = await callRoute(strength);
    expect(res.status).toBe(200);
    expect(res.json.exercises.map((e: any) => [e.name, e.sessions, e.lastDate])).toEqual([
      ["bench press", 2, "2026-10-08"],
      ["Squat", 1, "2026-10-08"],
    ]);
  });

  it("F23: seçilen egzersizin geçmişi ve rekorları", async () => {
    await session("2026-10-01", [["Bench Press", 80, 8], ["Bench Press", 85, 5]]);
    await session("2026-10-08", [["Bench Press", 80, 10]]);
    const res = await callRoute(strength, { query: { exercise: "BENCH PRESS" } });
    expect(res.json.history.map((d: any) => d.e1rm)).toEqual([101.3, 106.7]);
    expect(res.json.prs.bestE1rm).toMatchObject({ value: 106.7, date: "2026-10-08" });
    expect(res.json.prs.heaviest).toMatchObject({ weightKg: 85, reps: 5 });
  });
});

describe("F19: ısınma setleri istatistiğe girmez", () => {
  it("rekor ve haftalık hacim yalnız çalışma setlerinden hesaplanır", async () => {
    const today = getLocalDateString();
    await session(today, [["Bench Press", 100, 3, "warmup"], ["Bench Press", 80, 8], ["Bench Press", 60, 10, "warmup"]]);
    const detail = (await callRoute(strength, { query: { exercise: "Bench Press" } })).json;
    expect(detail.prs.heaviest).toMatchObject({ weightKg: 80, reps: 8 });
    expect(detail.history[0].sets).toBe(1);
    const vol = (await callRoute(volume, { query: { weeks: "1" } })).json;
    expect(vol.rows.find((r: any) => r.muscleId === "chest").sets).toEqual([1]);
  });
});

describe("GET /api/progress/volume", () => {
  it("F24: bu hafta ve önceki haftalar için kas grubu başına set", async () => {
    const today = getLocalDateString();
    await session(today, [["Bench Press", 80, 8], ["Bench Press", 80, 8], ["Squat", 100, 5]]);
    await session(addDaysToDateString(today, -7), [["Bench Press", 80, 8]]);
    const res = await callRoute(volume, { query: { weeks: "2" } });
    expect(res.status).toBe(200);
    expect(res.json.weeks).toHaveLength(2);
    expect(res.json.target).toEqual({ min: 10, max: 20 });
    expect(res.json.rows.find((r: any) => r.muscleId === "chest").sets).toEqual([1, 2]);
  });
});
