import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "@/app/api/cardio/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createProfile } from "../helpers/factories";

beforeEach(resetDatabase);

describe("/api/cardio", () => {
  it("F27: kayıt eklenir; kalori verilmezse profildeki kiloyla tahmin edilir; tempo döner", async () => {
    await createProfile({ currentWeightKg: 80 });
    const res = await callRoute(POST, { body: { date: "2026-10-30", kind: "run", durationMin: 27.5, distanceKm: 5, avgHr: 152, rpe: 7 } });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ kind: "run", distanceKm: 5, avgHr: 152, kcalEstimated: true, pace: "5:30 /km" });
    expect(res.json.kcal).toBeGreaterThan(300);

    const own = await callRoute(POST, { body: { date: "2026-10-30", kind: "walk", durationMin: 40, kcal: 150 } });
    expect(own.json).toMatchObject({ kcal: 150, kcalEstimated: false, pace: null });
  });

  it("F27: aralık listesi ve haftalık özet; silme; geçersiz giriş 400", async () => {
    await callRoute(POST, { body: { date: "2026-10-27", kind: "walk", durationMin: 30, distanceKm: 3 } });
    await callRoute(POST, { body: { date: "2026-10-29", kind: "cycle", durationMin: 60, distanceKm: 20 } });
    await callRoute(POST, { body: { date: "2026-10-10", kind: "run", durationMin: 20 } });
    const res = await callRoute(GET, { query: { from: "2026-10-26", to: "2026-11-01" } });
    expect(res.json.logs.map((l: any) => l.date)).toEqual(["2026-10-29", "2026-10-27"]);
    expect(res.json.summary).toEqual({ sessions: 2, minutes: 90, distanceKm: 23 });

    const id = res.json.logs[0].id;
    expect((await callRoute(DELETE, { method: "DELETE", query: { id } })).status).toBe(200);
    expect(await prisma.cardioLog.count()).toBe(2);
    expect((await callRoute(DELETE, { method: "DELETE", query: { id } })).status).toBe(404);
    expect((await callRoute(POST, { body: { kind: "fly", durationMin: 10 } })).status).toBe(400);
    expect((await callRoute(POST, { body: { kind: "run", durationMin: 0 } })).status).toBe(400);
  });
});
