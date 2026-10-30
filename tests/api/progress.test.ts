import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/progress/route";
import { prisma } from "@/lib/prisma";
import { addDaysToDateString, getLocalDateString } from "@/lib/date-utils";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

const today = () => getLocalDateString();

async function seedWeights(days: number, weightFor: (i: number) => number) {
  // i = 0 bugün, i = days-1 en eski gün
  await prisma.weightLog.createMany({
    data: Array.from({ length: days }, (_, i) => ({
      date: addDaysToDateString(today(), -i),
      weightKg: weightFor(i),
    })),
  });
}

describe("GET /api/progress — uzun kullanım", () => {
  it("70 günlük veride EN YENİ 60 kaydı döner ve bugünün kilosunu bulur", async () => {
    await seedWeights(70, (i) => 100 + i * 0.1); // bugün 100.0, en eski 106.9
    const res = await callRoute(GET);
    expect(res.status).toBe(200);
    expect(res.json.weights).toHaveLength(60);
    expect(res.json.weights.at(-1).date).toBe(today());
    expect(res.json.weights[0].date).toBe(addDaysToDateString(today(), -59));
    expect(res.json.today.weightKg).toBe(100);
  });

  it("60+ günlük kreatin geçmişinde bugünün işaretini doğru okur", async () => {
    await prisma.supplementLog.createMany({
      data: Array.from({ length: 65 }, (_, i) => ({
        date: addDaysToDateString(today(), -i),
        name: "Kreatin Monohidrat",
        doseGrams: 5,
        taken: i === 0, // yalnız bugün alındı
      })),
    });
    const res = await callRoute(GET);
    expect(res.json.today.creatineTaken).toBe(true);
    expect(res.json.creatineCompliance.at(-1)).toEqual({ date: today(), taken: true });
    expect(res.json.creatineCompliance).toHaveLength(7);
  });

  it("haftalık fark takvim günlerine göre hesaplanır: son 7 gün ort. − önceki 7 gün ort.", async () => {
    await seedWeights(14, (i) => (i < 7 ? 100 : 101)); // son hafta 100, önceki hafta 101
    const res = await callRoute(GET);
    expect(res.json.weeklyWeightDelta).toBe(-1);
  });

  it("aradaki boş günler haftalık farkı bozmaz (kayıt sayısı değil tarih esas alınır)", async () => {
    // Son 7 günde yalnız 2 kayıt (100), önceki 7 günde 7 kayıt (102)
    await prisma.weightLog.createMany({
      data: [
        { date: today(), weightKg: 100 },
        { date: addDaysToDateString(today(), -3), weightKg: 100 },
        ...Array.from({ length: 7 }, (_, i) => ({ date: addDaysToDateString(today(), -7 - i), weightKg: 102 })),
      ],
    });
    const res = await callRoute(GET);
    expect(res.json.weeklyWeightDelta).toBe(-2);
  });
});

describe("B04: veri yokken uydurma değer yok", () => {
  it("kilo kaydı yokken haftalık fark null; kreatin takibi yoksa izlenmiyor", async () => {
    const res = await callRoute(GET);
    expect(res.json.weeklyWeightDelta).toBeNull();
    expect(res.json.creatineTracked).toBe(false);
  });

  it("kreatin takviyesi ya da kaydı varsa izleniyor sayılır", async () => {
    await prisma.supplement.create({ data: { name: "Kreatin Monohidrat", doseAmount: 5, doseUnit: "g" } });
    expect((await callRoute(GET)).json.creatineTracked).toBe(true);
  });

  it("yalnız tek alan gönderilince diğer iyilik hâli alanları boş kalır (3/5, 7 saat yazılmaz)", async () => {
    await callRoute(POST, { body: { date: today(), mood1to5: 4 } });
    const row = await prisma.dailyWellbeing.findUnique({ where: { date: today() } });
    expect(row).toMatchObject({ mood1to5: 4, energy1to5: null, sleepMinutes: null, hunger1to5: null, stress1to5: null });
    const res = await callRoute(GET);
    expect(res.json.today).toMatchObject({ energy1to5: null, sleepMinutes: null });
  });
});

describe("POST /api/progress", () => {
  it("kilo + kreatin kaydını aynı gün için günceller (upsert)", async () => {
    await callRoute(POST, { body: { date: today(), weightKg: 101.2, creatineTaken: true } });
    await callRoute(POST, { body: { date: today(), weightKg: 100.8, creatineTaken: false } });
    expect(await prisma.weightLog.count()).toBe(1);
    const res = await callRoute(GET);
    expect(res.json.today).toMatchObject({ weightKg: 100.8, creatineTaken: false });
  });

  it("geçersiz değeri 400 ile reddeder", async () => {
    const res = await callRoute(POST, { body: { date: today(), energy1to5: 9 } });
    expect(res.status).toBe(400);
  });
});

describe("F51: kas ağrısı ve ruh hâli", () => {
  it("kaydedilir ve bugünün özetinde (stresle birlikte) döner", async () => {
    const res = await callRoute(POST, { body: { date: today(), energy1to5: 4, sleepMinutes: 450, stress1to5: 2, soreness1to5: 3, mood1to5: 5 } });
    expect(res.status).toBeLessThan(300);
    const day = (await callRoute(GET)).json.today;
    expect(day).toMatchObject({ energy1to5: 4, sleepMinutes: 450, stress1to5: 2, soreness1to5: 3, mood1to5: 5 });
    expect((await callRoute(POST, { body: { date: today(), soreness1to5: 6 } })).status).toBe(400);
  });
});
