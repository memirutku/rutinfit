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
