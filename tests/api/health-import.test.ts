import { beforeEach, describe, expect, it } from "vitest";
import { GET, DELETE } from "@/app/api/health/route";
import { POST as IMPORT } from "@/app/api/health/import/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { addDaysToDateString, getLocalDateString } from "@/lib/date-utils";

beforeEach(resetDatabase);

const today = getLocalDateString();
const day = (n: number) => addDaysToDateString(today, -n);
const steps = (n: number, value: number) => ({ key: `steps:${day(n)}`, type: "steps", date: day(n), value, unit: "count", source: "Apple Watch" });

describe("/api/health (F62)", () => {
  it("içe aktarma anahtara göre günceller: aynı dosyayı iki kez yüklemek kopya oluşturmaz", async () => {
    const batch = [
      steps(0, 8000),
      steps(1, 6000),
      { key: `weight_kg:${day(1)}`, type: "weight_kg", date: day(1), value: 100.2, unit: "kg", source: "Tartı" },
      {
        key: `workout:${day(1)} 19:00:00 +0300:Running`,
        type: "workout",
        date: day(1),
        value: 30.5,
        unit: "min",
        source: "Apple Watch",
        detail: { activity: "Koşu", durationMin: 30.5, distanceKm: 5, kcal: 320 },
      },
    ];
    const first = await callRoute(IMPORT, { body: { records: batch } });
    expect(first.status).toBe(200);
    expect(first.json).toEqual({ created: 4, updated: 0 });
    const again = await callRoute(IMPORT, { body: { records: [...batch.slice(1), steps(0, 8500)] } });
    expect(again.json).toEqual({ created: 0, updated: 4 });
    expect(await prisma.healthRecord.count()).toBe(4);
    expect((await prisma.healthRecord.findUnique({ where: { key: `steps:${today}` } }))?.value).toBe(8500);
  });

  it("geçersiz kayıt 400 ve hiçbir şey yazılmaz; parti sınırı 5000", async () => {
    const bad = await callRoute(IMPORT, { body: { records: [steps(0, 100), { ...steps(1, 100), type: "sleep" }] } });
    expect(bad.status).toBe(400);
    expect(await prisma.healthRecord.count()).toBe(0);
    const big = Array.from({ length: 5001 }, (_, i) => ({ ...steps(0, 1), key: `steps:x${i}` }));
    expect((await callRoute(IMPORT, { body: { records: big } })).status).toBe(400);
  });

  it("özet: adım ortalamaları, son nabız, kilo (kendi kaydıyla yan yana), son antrenmanlar; kendi kayıtlarına dokunmaz", async () => {
    await prisma.weightLog.create({ data: { date: day(2), weightKg: 101 } });
    await callRoute(IMPORT, {
      body: {
        records: [
          ...Array.from({ length: 10 }, (_, i) => steps(i, 7000 + i * 100)),
          { key: `resting_hr:${day(0)}`, type: "resting_hr", date: day(0), value: 61, unit: "bpm", source: "Apple Watch" },
          { key: `weight_kg:${day(1)}`, type: "weight_kg", date: day(1), value: 100.2, unit: "kg", source: "Tartı" },
          { key: "workout:a", type: "workout", date: day(3), value: 45, unit: "min", source: "Apple Watch", detail: { activity: "Yürüyüş", durationMin: 45, distanceKm: 4, kcal: 200 } },
        ],
      },
    });
    const res = await callRoute(GET);
    expect(res.json.total).toBe(13);
    expect(res.json.steps.avg7).toBe(7300); // 7000..7600
    expect(res.json.steps.series).toHaveLength(10);
    expect(res.json.restingHr.latest).toEqual({ value: 61, date: day(0) });
    expect(res.json.weight).toEqual({ latest: { value: 100.2, date: day(1) }, ownLatest: { value: 101, date: day(2) } });
    expect(res.json.workouts[0]).toMatchObject({ date: day(3), detail: { activity: "Yürüyüş", distanceKm: 4 } });
    expect(await prisma.weightLog.count()).toBe(1);
    expect(await prisma.cardioLog.count()).toBe(0);

    const del = await callRoute(DELETE, { method: "DELETE" });
    expect(del.json).toEqual({ deleted: 13 });
    expect((await callRoute(GET)).json.total).toBe(0);
  });
});
