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

  it("H3: set RPE'si kaydedilir; seans RPE'si setlerin yuvarlanmış ortalamasıdır", async () => {
    await callRoute(POST, { body: { csvText: CSV } });
    const a = await prisma.workoutSession.findFirstOrThrow({
      where: { name: "Ağırlık A" },
      include: { setLogs: { orderBy: { setNumber: "asc" } } },
    });
    expect(a.setLogs.map((s) => s.rpe)).toEqual([7, 8]);
    expect(a.rpe).toBe(8); // (7 + 8) / 2 = 7,5 → 8
  });

  it("H4: 'hedef tuttu' eşleşen şablonun üst tekrar sınırından gelir; şablon yoksa false", async () => {
    const tpl = await prisma.workoutTemplate.create({
      data: {
        name: "Ağırlık A",
        type: "strength",
        dayOfWeek: 1,
        exercises: { create: [{ exerciseName: "bench press", repMin: 6, repMax: 10 }] },
      },
    });
    const csv = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps
2026-10-15,Ağırlık A,Bench Press,1,60,10
2026-10-15,Ağırlık A,Bench Press,2,60,9
2026-10-15,Ağırlık A,Squat,1,80,12`;
    await callRoute(POST, { body: { csvText: csv } });
    const session = await prisma.workoutSession.findFirstOrThrow({ include: { setLogs: true } });
    expect(session.templateId).toBe(tpl.id);
    const met = Object.fromEntries(session.setLogs.map((s) => [`${s.exerciseName}#${s.setNumber}`, s.isTargetMet]));
    expect(met).toEqual({ "Bench Press#1": true, "Bench Press#2": false, "Squat#1": false });
  });

  it("H1/H2: özet mesajı uyarıları ve aktarılmayan sütunları söyler; F19: ısınma seti tipiyle kaydedilir", async () => {
    const csv = `Date,Workout Name,Exercise Name,Set Type,Reps,Distance
2026-10-15,A,Push Up,warmup,10,
2026-10-15,A,Push Up,normal,15,1.2`;
    const res = await callRoute(POST, { body: { csvText: csv } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ ignoredColumns: ["Distance"] });
    expect(res.json.warnings).toHaveLength(1);
    expect(res.json.message).not.toMatch(/ısınma/);
    const sets = await prisma.setLog.findMany({ orderBy: { setNumber: "asc" } });
    expect(sets.map((s) => [s.setType, s.isTargetMet])).toEqual([["warmup", false], ["normal", false]]);
    expect(res.json.message).toMatch(/Distance/);
    expect(res.json.message).toMatch(/Ağırlık sütunu bulunamadı/);
  });

  it("boş içerik 400, ayrıştırılamayan CSV 422 döner", async () => {
    expect((await callRoute(POST, { body: { csvText: "" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { csvText: "a,b\n1,2" } })).status).toBe(422);
  });
});
