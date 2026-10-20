import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/workouts/import/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

const CSV = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2026-10-15 19:40:00,Ağırlık A,42m,Bench Press,1,60,10,,,,,7
2026-10-15 19:40:00,Ağırlık A,42m,Bench Press,2,60,9,,,,,8
2026-10-16 19:40:00,Ağırlık B,40m,Squat,1,80,8,,,,,8`;

describe("POST /api/workouts/import", () => {
  it("CSV'yi kaydeder; aynı dosya tekrar yüklenince kopya oluşturmaz", async () => {
    const first = await callRoute(POST, { body: { csvText: CSV } });
    expect(first.status).toBe(200);
    expect(first.json.savedWorkoutsCount).toBe(2);
    expect(await prisma.setLog.count()).toBe(3);

    const second = await callRoute(POST, { body: { csvText: CSV } });
    expect(second.json.savedWorkoutsCount).toBe(0);
    expect(second.json.skippedDuplicates).toBe(2);
    expect(await prisma.workoutSession.count()).toBe(2);
  });

  it("boş içerik 400, ayrıştırılamayan CSV 422 döner", async () => {
    expect((await callRoute(POST, { body: { csvText: "" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { csvText: "a,b\n1,2" } })).status).toBe(422);
  });
});
