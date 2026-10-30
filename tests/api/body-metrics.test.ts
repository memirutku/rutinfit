import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT, DELETE } from "@/app/api/body-metrics/route";
import { POST as PROGRESS_POST } from "@/app/api/progress/route";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createProfile } from "../helpers/factories";

beforeEach(resetDatabase);

describe("/api/body-metrics (F16)", () => {
  it("aynı güne verilen alanlar birleşir; boş bırakılanlar silinmez, null verilen silinir", async () => {
    expect((await callRoute(PUT, { method: "PUT", body: { date: "2026-10-01", waistCm: 102, hipCm: 108 } })).status).toBe(200);
    const res = await callRoute(PUT, { method: "PUT", body: { date: "2026-10-01", restingHr: 62, hipCm: null } });
    expect(res.json).toMatchObject({ date: "2026-10-01", waistCm: 102, hipCm: null, restingHr: 62 });
  });

  it("geçersiz değerler 400: aralık dışı, tamsayı olmayan nabız, büyük tansiyon küçükten küçük", async () => {
    const bad = [
      { date: "2026-10-01", waistCm: 5 },
      { date: "2026-10-01", restingHr: 61.5 },
      { date: "2026-10-01", systolic: 80, diastolic: 90 },
      { date: "2026-13-01", waistCm: 90 },
      { date: "2026-10-01", bodyFatPercent: 90 },
    ];
    for (const body of bad) expect((await callRoute(PUT, { method: "PUT", body })).status).toBe(400);
  });

  it("son değerler, aralıktaki değişim, bel/boy oranı ve tansiyon uyarısı", async () => {
    await createProfile({ heightCm: 180 });
    await callRoute(PUT, { method: "PUT", body: { date: "2026-09-01", waistCm: 104, systolic: 128, diastolic: 82 } });
    await callRoute(PUT, { method: "PUT", body: { date: "2026-10-01", waistCm: 99.5, bodyFatPercent: 24 } });
    await callRoute(PUT, { method: "PUT", body: { date: "2026-10-15", systolic: 146, diastolic: 88 } });
    const res = await callRoute(GET, { query: { from: "2026-08-01", to: "2026-10-31" } });
    expect(res.json.entries.map((e: any) => e.date)).toEqual(["2026-09-01", "2026-10-01", "2026-10-15"]);
    expect(res.json.latest.waistCm).toEqual({ value: 99.5, date: "2026-10-01" });
    expect(res.json.latest.systolic).toEqual({ value: 146, date: "2026-10-15" });
    expect(res.json.changes.waistCm).toEqual({ from: 104, to: 99.5, delta: -4.5 });
    expect(res.json.changes.bodyFatPercent).toBeUndefined(); // tek ölçüm
    expect(res.json.waistToHeight).toMatchObject({ ratio: 0.55, elevated: true });
    expect(res.json.bloodPressure).toMatchObject({ level: "high", systolic: 146, diastolic: 88 });
  });

  it("çok yüksek tansiyonda acil uyarısı; silme; eski kilo uç noktası bel ölçüsünü hâlâ yazar", async () => {
    await callRoute(PUT, { method: "PUT", body: { date: "2026-10-20", systolic: 185, diastolic: 110 } });
    const res = await callRoute(GET, { query: { from: "2026-10-01", to: "2026-10-31" } });
    expect(res.json.bloodPressure.level).toBe("very_high");
    expect(res.json.bloodPressure.message).toMatch(/112/);
    expect((await callRoute(DELETE, { method: "DELETE", query: { date: "2026-10-20" } })).status).toBe(200);
    expect((await callRoute(DELETE, { method: "DELETE", query: { date: "2026-10-20" } })).status).toBe(404);

    await callRoute(PROGRESS_POST, { body: { date: "2026-10-21", waistCm: 98 } });
    const after = await callRoute(GET, { query: { from: "2026-10-01", to: "2026-10-31" } });
    expect(after.json.latest.waistCm).toEqual({ value: 98, date: "2026-10-21" });
  });
});
