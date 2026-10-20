import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/opengym/sync/route";
import { prisma } from "@/lib/prisma";
import { mapOpenGymWorkoutToRutinFit } from "@/lib/opengym-client";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

let dir: string;

beforeEach(async () => {
  await resetDatabase();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "opengym-sync-"));
  vi.stubEnv("OPENGYM_DATA_DIR", dir);
  fs.writeFileSync(
    path.join(dir, "state-user.json"),
    JSON.stringify({
      workouts: [
        {
          id: "w1",
          date: "2026-10-18",
          name: "Göğüs Günü",
          durationSeconds: 2700,
          exercises: [{ exerciseId: "bench", name: "Bench Press", sets: [{ weight: 80, reps: 10, rpe: 7.5 }, { weight: 80, reps: 8 }] }],
        },
      ],
      bodyWeight: [],
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("mapOpenGymWorkoutToRutinFit", () => {
  it("SetLog tablosunda olmayan alan üretmez ve RPE'yi 1–10 tam sayıya yuvarlar", () => {
    const mapped = mapOpenGymWorkoutToRutinFit({
      id: "x",
      date: "2026-10-18",
      name: "A",
      exercises: [{ exerciseId: "e", sets: [{ weight: 50, reps: 5, rpe: 7.5 }] }],
    });
    expect(Object.keys(mapped.setLogs[0]).sort()).toEqual(["exerciseName", "isTargetMet", "reps", "setNumber", "weightKg"]);
    expect(mapped.rpe).toBe(8);
  });
});

describe("POST /api/opengym/sync", () => {
  it("antrenmanı setleriyle içe aktarır; ikinci çalıştırma kopya oluşturmaz", async () => {
    const first = await callRoute(POST, { method: "POST" });
    expect(first.status).toBe(200);
    expect(first.json.importedWorkouts).toBe(1);
    expect(await prisma.setLog.count()).toBe(2);

    const second = await callRoute(POST, { method: "POST" });
    expect(second.json.importedWorkouts).toBe(0);
    expect(await prisma.workoutSession.count()).toBe(1);
  });

  it("RutinFit kilolarını openGym durum dosyasına yazar", async () => {
    await prisma.weightLog.create({ data: { date: "2026-10-18", weightKg: 99.5 } });
    const res = await callRoute(POST, { method: "POST" });
    expect(res.json.syncedWeights).toBe(1);
    const state = JSON.parse(fs.readFileSync(path.join(dir, "state-user.json"), "utf-8"));
    expect(state.bodyWeight).toEqual([{ date: "2026-10-18", weight: 99.5 }]);
  });
});
