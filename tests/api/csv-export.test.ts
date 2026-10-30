import fs from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/export/csv/route";
import { prisma } from "@/lib/prisma";
import { parseCsv, parseWorkoutCsv } from "@/lib/workout-importer";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

async function csv(type: string, query: Record<string, string> = {}) {
  const res = await callRoute(GET, { query: { type, ...query } });
  return { res, rows: parseCsv(res.text.replace(/^﻿/, "")) };
}

describe("GET /api/export/csv", () => {
  it("F60: besin günlüğü tarih sırasıyla, Türkçe öğün adıyla ve noktalı ondalıkla", async () => {
    await prisma.foodLog.create({ data: { date: "2026-10-30", time: "08:00", mealType: "breakfast", name: "Yulaf, sütlü", grams: 60.5, caloriesSnapshot: 223.9, proteinSnapshot: 8, carbsSnapshot: 36.4, fatSnapshot: 4 } });
    await prisma.foodLog.create({ data: { date: "2026-10-29", time: "20:00", mealType: "dinner", name: "Mercimek", grams: 300, caloriesSnapshot: 350, proteinSnapshot: 20, carbsSnapshot: 50, fatSnapshot: 8 } });
    const { res, rows } = await csv("food-log");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/rutinfit-besin-gunlugu-\d{4}-\d{2}-\d{2}\.csv/);
    expect(rows[0]).toEqual(["date", "time", "meal", "name", "grams", "kcal", "protein_g", "carbs_g", "fat_g"]);
    expect(rows.slice(1).map((r) => r[3])).toEqual(["Mercimek", "Yulaf, sütlü"]);
    expect(rows[2]).toEqual(["2026-10-30", "08:00", "Kahvaltı", "Yulaf, sütlü", "60.5", "223.9", "8", "36.4", "4"]);
  });

  it("F60: antrenman CSV'si Strong biçiminde ve RutinFit'e kayıpsız geri içe aktarılır", async () => {
    await prisma.workoutSession.create({
      data: {
        date: "2026-10-28",
        name: "Ağırlık A",
        durationMinutes: 50,
        notes: "Güzel seans",
        setLogs: {
          create: [
            { exerciseName: "Bench Press", setNumber: 1, weightKg: 82.5, reps: 8, rpe: 8.5 },
            { exerciseName: "Bench Press", setNumber: 2, weightKg: 82.5, reps: 7 },
          ],
        },
      },
    });
    await prisma.workoutSession.create({ data: { date: "2026-10-29", name: "Plan", completed: false } });
    const { res } = await csv("workouts");
    const parsed = parseWorkoutCsv(res.text);
    expect(parsed.appType).toBe("strong");
    expect(parsed.workouts).toHaveLength(1);
    expect(parsed.workouts[0]).toMatchObject({ date: "2026-10-28", name: "Ağırlık A", durationMinutes: 50 });
    expect(parsed.workouts[0].notes).toContain("Güzel seans");
    expect(parsed.workouts[0].sets.map((s) => [s.weightKg, s.reps, s.rpe])).toEqual([
      [82.5, 8, 8.5],
      [82.5, 7, undefined],
    ]);
  });

  it("F60: vücut ölçüleri kilo ve bel kayıtlarını tarihe göre birleştirir; bir kopya uygulama klasörüne yazılır", async () => {
    await prisma.weightLog.create({ data: { date: "2026-10-28", weightKg: 110.4 } });
    await prisma.weightLog.create({ data: { date: "2026-10-29", weightKg: 110.1 } });
    await prisma.bodyMeasurement.create({ data: { date: "2026-10-29", waistCm: 104 } });
    const { res, rows } = await csv("body");
    expect(rows).toEqual([
      ["date", "weight_kg", "waist_cm"],
      ["2026-10-28", "110.4", ""],
      ["2026-10-29", "110.1", "104"],
    ]);
    const saved = decodeURIComponent(res.headers.get("x-rutinfit-export-path") ?? "");
    expect(fs.existsSync(saved)).toBe(true);
  });

  it("tarih aralığı süzer; bilinmeyen tür 400", async () => {
    await prisma.weightLog.create({ data: { date: "2026-09-01", weightKg: 112 } });
    await prisma.weightLog.create({ data: { date: "2026-10-01", weightKg: 111 } });
    expect((await csv("body", { from: "2026-09-15" })).rows).toHaveLength(2);
    expect((await callRoute(GET, { query: { type: "x" } })).status).toBe(400);
  });
});
