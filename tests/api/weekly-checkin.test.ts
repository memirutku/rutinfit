import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/checkins/route";
import { computeWeeklyMetrics } from "@/lib/services/weekly-checkin";
import { prisma } from "@/lib/prisma";
import { addDaysToDateString, getLocalDateString, startOfWeek } from "@/lib/date-utils";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createMealPlan, createProfile } from "../helpers/factories";
import { startMockLLMServer, type MockLLMServer } from "../helpers/mock-llm-server";

let llm: MockLLMServer;
beforeAll(async () => {
  llm = await startMockLLMServer();
});
afterAll(() => llm.close());
beforeEach(async () => {
  await resetDatabase();
  llm.requests.length = 0;
});

const WEEK = "2026-10-19"; // Pazartesi
const day = (i: number) => addDaysToDateString(WEEK, i);
async function food(date: string, kcal: number, protein: number) {
  await prisma.foodLog.create({ data: { date, time: "12:00", mealType: "lunch", name: "x", grams: 100, caloriesSnapshot: kcal, proteinSnapshot: protein, carbsSnapshot: 0, fatSnapshot: 0 } });
}

describe("F49: haftalık metrikler (kodda hesaplanır)", () => {
  it("kayıt, kalori uyumu, protein, kilo eğilimi, antrenman, kardiyo ve plana uyum", async () => {
    await createProfile({ calorieTarget: 2000, calorieCeiling: 2100, proteinTargetG: 150 });
    await food(day(0), 1950, 155);
    await food(day(1), 2400, 120); // tavan üstü
    await food(day(2), 1900, 140);
    await food(day(3), 2050, 160);
    await prisma.weightLog.createMany({ data: [{ date: addDaysToDateString(WEEK, -3), weightKg: 101 }, { date: addDaysToDateString(WEEK, -1), weightKg: 100.6 }, { date: day(2), weightKg: 100.2 }, { date: day(5), weightKg: 99.8 }] });
    await prisma.workoutSession.create({ data: { date: day(1), name: "A", setLogs: { create: [{ exerciseName: "Squat", setNumber: 1, weightKg: 80, reps: 5 }, { exerciseName: "Squat", setNumber: 2, weightKg: 40, reps: 8, setType: "warmup" }] } } });
    await prisma.cardioLog.create({ data: { date: day(4), kind: "walk", durationMin: 40 } });
    const plan = await createMealPlan(day(0), [{ mealType: "lunch", customName: "Köfte" }]);
    await prisma.plannedMeal.update({ where: { id: plan.meals[0].id }, data: { adherence: "done" } });

    const m = await computeWeeklyMetrics(WEEK);
    expect(m).toMatchObject({
      weekStart: WEEK,
      weekEnd: day(6),
      loggedDays: 4,
      avgCalories: 2075,
      daysOnTarget: 3,
      avgProtein: 144,
      proteinDaysHit: 3,
      workouts: 1,
      workingSets: 1,
      cardioMinutes: 40,
      planAdherencePercent: 100,
    });
    expect(m.weightDeltaKg).toBeCloseTo(-0.8, 1); // 100 ort. − 100,8 ort.
  });
});

describe("/api/checkins", () => {
  it("F49: model kapalıyken kurallı özet yazar; tek öneri seçer; aynı hafta yeniden oluşturulunca değişir", async () => {
    await createProfile({ calorieTarget: 2000, proteinTargetG: 150 });
    await prisma.aISettings.create({ data: { id: "default-ai", coachEnabled: false } });
    const weekStart = addDaysToDateString(startOfWeek(getLocalDateString()), -7);
    await food(weekStart, 1900, 80);
    await food(addDaysToDateString(weekStart, 1), 1950, 90);

    const res = await callRoute(POST, { method: "POST" });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ weekStart, aiGenerated: false });
    expect(res.json.summary).toMatch(/2 gün/);
    // Kayıt %70'in altında: önce kayıt alışkanlığı önerilir.
    expect(res.json.suggestion).toMatchObject({ kind: "habit" });
    await callRoute(POST, { method: "POST" });
    expect(await prisma.weeklyCheckin.count()).toBe(1);
    expect((await callRoute(GET)).json.checkins).toHaveLength(1);
  });

  it("F49: model açıkken metrikler istemde verilir, özet modelden gelir (AI etiketli)", async () => {
    await createProfile({ calorieTarget: 2000, proteinTargetG: 150 });
    await prisma.aISettings.create({ data: { id: "default-ai", baseUrl: llm.baseUrl, modelName: "mock" } });
    const weekStart = addDaysToDateString(startOfWeek(getLocalDateString()), -7);
    for (let i = 0; i < 7; i++) await food(addDaysToDateString(weekStart, i), 2000, 100);
    llm.queueReply("Bu hafta her gün kayıt girdin. Kalori hedefine yakınsın. Protein düşük kaldı.");
    const res = await callRoute(POST, { method: "POST" });
    expect(res.json).toMatchObject({ aiGenerated: true, summary: expect.stringMatching(/her gün kayıt/) });
    expect(res.json.suggestion).toMatchObject({ kind: "protein" });
    const prompt = JSON.stringify(llm.requests[0].body.messages);
    expect(prompt).toContain("7/7");
    expect(prompt).toContain("Proteini artır");
  });
});
