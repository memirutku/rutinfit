import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/progress/adaptive-tdee/route";
import { prisma } from "@/lib/prisma";
import { addDaysToDateString, getLocalDateString } from "@/lib/date-utils";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createProfile } from "../helpers/factories";

beforeEach(resetDatabase);

async function seed21() {
  const today = getLocalDateString();
  for (let i = 1; i <= 21; i++) {
    const date = addDaysToDateString(today, -i);
    await prisma.foodLog.create({ data: { date, time: "12:00", mealType: "lunch", name: "x", grams: 100, caloriesSnapshot: 2000, proteinSnapshot: 0, carbsSnapshot: 0, fatSnapshot: 0 } });
    await prisma.weightLog.create({ data: { date, weightKg: 100 + (0.5 / 7) * i } }); // geçmişe gittikçe ağır: kayıp
  }
}

describe("GET /api/progress/adaptive-tdee", () => {
  it("F10: tahmin, formülle karşılaştırma ve gerekçeli hedef önerisi", async () => {
    await createProfile({ sex: "male", age: 30, heightCm: 180, currentWeightKg: 100, activityLevel: "light", goalType: "lose", goalRateKgPerWeek: 0.5, calorieTarget: 2300 });
    await seed21();
    const res = await callRoute(GET);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ ok: true, tdee: 2550, confidence: "high", currentTarget: 2300 });
    expect(res.json.formulaTdee).toBeGreaterThan(2000);
    expect(res.json.suggestion).toMatchObject({ calorieTarget: 2000, delta: -300 });
    expect(res.json.suggestion.reason).toMatch(/0,5 kg/);
  });

  it("öneri 100 kcal'den küçük farkta verilmez; yetersiz veride gerekçe döner", async () => {
    await createProfile({ goalType: "lose", goalRateKgPerWeek: 0.5, calorieTarget: 2030 });
    expect((await callRoute(GET)).json).toMatchObject({ ok: false });
    await seed21();
    expect((await callRoute(GET)).json.suggestion).toBeNull();
  });
});
