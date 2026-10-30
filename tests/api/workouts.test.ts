import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/workouts/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

const session = (setLogs: any[]) => ({
  date: "2026-10-18",
  name: "Ağırlık A",
  durationMinutes: 45,
  rpe: 7,
  setLogs,
});

beforeEach(resetDatabase);

describe("POST /api/workouts", () => {
  it("seansı setleriyle kaydeder; hedef üst tekrar sınırına ulaşan set 'hedef tuttu' sayılır", async () => {
    const res = await callRoute(POST, {
      body: session([
        { exerciseName: "Bench Press", setNumber: 1, weightKg: 80, reps: 10, targetRepMin: 8, targetRepMax: 10 },
        { exerciseName: "Bench Press", setNumber: 2, weightKg: 80, reps: 8, targetRepMin: 8, targetRepMax: 10 },
      ]),
    });

    expect(res.status).toBe(201);
    const sets = await prisma.setLog.findMany({ orderBy: { setNumber: "asc" } });
    expect(sets.map((s) => s.isTargetMet)).toEqual([true, false]);
    expect(res.json.progressionFeedbacks["Bench Press"]).toBeDefined();
  });

  it("F20: set başına RPE (yarım puanlı) kaydedilir ve döner; aralık dışı RPE 400", async () => {
    const res = await callRoute(POST, {
      body: session([
        { exerciseName: "Squat", setNumber: 1, weightKg: 100, reps: 5, rpe: 8.5 },
        { exerciseName: "Squat", setNumber: 2, weightKg: 100, reps: 5 },
      ]),
    });
    expect(res.status).toBe(201);
    const sets = await prisma.setLog.findMany({ orderBy: { setNumber: "asc" } });
    expect(sets.map((s) => s.rpe)).toEqual([8.5, null]);

    const bad = await callRoute(POST, {
      body: session([{ exerciseName: "Squat", setNumber: 1, weightKg: 100, reps: 5, rpe: 11 }]),
    });
    expect(bad.status).toBe(400);
  });

  it("F19: set tipi kaydedilir; ısınma seti 'hedef tuttu' sayılmaz ve ilerleme kararına girmez", async () => {
    const res = await callRoute(POST, {
      body: session([
        { exerciseName: "Squat", setNumber: 1, weightKg: 40, reps: 5, targetRepMin: 8, targetRepMax: 10, setType: "warmup" },
        { exerciseName: "Squat", setNumber: 2, weightKg: 100, reps: 10, targetRepMin: 8, targetRepMax: 10 },
        { exerciseName: "Squat", setNumber: 3, weightKg: 100, reps: 10, targetRepMin: 8, targetRepMax: 10, setType: "failure" },
      ]),
    });
    expect(res.status).toBe(201);
    const sets = await prisma.setLog.findMany({ orderBy: { setNumber: "asc" } });
    expect(sets.map((s) => [s.setType, s.isTargetMet])).toEqual([["warmup", false], ["normal", true], ["failure", true]]);
    // Isınma (5 tekrar) hesaba girseydi "tüm setlerde üst sınır" sağlanmazdı.
    expect(res.json.progressionFeedbacks.Squat).toMatchObject({ isTargetMetAllSets: true, recommendedNextWeightKg: 102.5 });
    expect((await callRoute(POST, { body: session([{ exerciseName: "X", setNumber: 1, weightKg: 1, reps: 1, setType: "süper" }]) })).status).toBe(400);
  });

  it("F21: şablondaki egzersiz başına artış miktarı ilerleme önerisinde kullanılır", async () => {
    const tpl = await prisma.workoutTemplate.create({
      data: { name: "A", type: "strength", dayOfWeek: 1, exercises: { create: [{ exerciseName: "Deadlift", repMin: 3, repMax: 5, incrementKg: 5 }] } },
    });
    const res = await callRoute(POST, {
      body: { ...session([{ exerciseName: "Deadlift", setNumber: 1, weightKg: 140, reps: 5, targetRepMin: 3, targetRepMax: 5 }]), templateId: tpl.id },
    });
    expect(res.json.progressionFeedbacks.Deadlift.recommendedNextWeightKg).toBe(145);
  });

  it("F21: üç seanstır yeni rekor yoksa durağanlık uyarısı verir", async () => {
    const day = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
    const bench = (reps: number) => [{ exerciseName: "Bench Press", setNumber: 1, weightKg: 80, reps, targetRepMin: 6, targetRepMax: 10 }];
    await callRoute(POST, { body: { ...session(bench(8)), date: day(1) } }); // rekor
    await callRoute(POST, { body: { ...session(bench(7)), date: day(4) } });
    await callRoute(POST, { body: { ...session(bench(8)), date: day(8) } });
    const third = await callRoute(POST, { body: { ...session(bench(6)), date: day(11) } });
    expect(third.json.progressionFeedbacks["Bench Press"].plateau).toMatchObject({ sessions: 3 });
    expect(third.json.progressionFeedbacks["Bench Press"].plateau.message).toMatch(/deload/i);
  });

  it("negatif ağırlığı 400 ile reddeder ve hiçbir şey yazmaz", async () => {
    const res = await callRoute(POST, {
      body: session([{ exerciseName: "Squat", setNumber: 1, weightKg: -10, reps: 5 }]),
    });
    expect(res.status).toBe(400);
    expect(await prisma.workoutSession.count()).toBe(0);
  });
});

describe("GET /api/workouts", () => {
  it("tarih filtresiyle yalnız o günün seanslarını döner", async () => {
    await callRoute(POST, { body: session([]) });
    await callRoute(POST, { body: { ...session([]), date: "2026-10-19" } });
    const res = await callRoute(GET, { query: { date: "2026-10-19" } });
    expect(res.status).toBe(200);
    expect(res.json.sessions).toHaveLength(1);
    expect(res.json.sessions[0].date).toBe("2026-10-19");
  });
});
