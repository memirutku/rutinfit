import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/reports/dietitian/route";
import { GET as XLSX_GET } from "@/app/api/reports/dietitian/xlsx/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createProfile } from "../helpers/factories";

beforeEach(resetDatabase);

const log = (date: string, time: string, mealType: string, name: string, grams: number, kcal: number, protein: number) =>
  prisma.foodLog.create({ data: { date, time, mealType, name, grams, caloriesSnapshot: kcal, proteinSnapshot: protein, carbsSnapshot: 10, fatSnapshot: 5 } });

async function seed() {
  await createProfile({ age: 35, sex: "female", heightCm: 165, calorieTarget: 1800, calorieCeiling: 1900, proteinTargetG: 110, coachNotes: "Laktoz intoleransı" });
  await log("2026-10-19", "08:00", "breakfast", "Yulaf", 60, 230, 8);
  await log("2026-10-19", "13:00", "lunch", "Mercimek Çorbası", 300, 1500, 60);
  await log("2026-10-20", "09:00", "breakfast", "Yumurta", 100, 2100, 70);
  await prisma.drinkLog.create({ data: { date: "2026-10-19", time: "10:00", kind: "water", name: "Su", ml: 1500 } });
  await prisma.weightLog.create({ data: { date: "2026-10-19", weightKg: 80.4 } });
  await prisma.weightLog.create({ data: { date: "2026-10-25", weightKg: 79.6 } });
  await prisma.weightLog.create({ data: { date: "2026-10-10", weightKg: 82 } }); // aralık dışı
  await prisma.cardioLog.create({ data: { date: "2026-10-20", kind: "walk", durationMin: 40, kcal: 150 } });
  await prisma.supplement.create({ data: { name: "D Vitamini", doseAmount: 1000, doseUnit: "IU" } });
  await prisma.supplementLog.create({ data: { date: "2026-10-19", name: "D Vitamini", doseGrams: 1000, doseUnit: "IU" } });
}

describe("/api/reports/dietitian (F77)", () => {
  it("özet, günlük tablo, öğün günlüğü ve notlar; yalnız seçilen aralık", async () => {
    await seed();
    const res = await callRoute(GET, { query: { from: "2026-10-19", to: "2026-10-25" } });
    expect(res.status).toBe(200);
    const r = res.json;
    expect(r).toMatchObject({ from: "2026-10-19", to: "2026-10-25", dayCount: 7, loggedDays: 2 });
    expect(r.profile).toMatchObject({ age: 35, sex: "female", heightCm: 165, calorieTarget: 1800, proteinTargetG: 110, notes: "Laktoz intoleransı" });
    expect(r.days).toHaveLength(7);
    expect(r.days[0]).toMatchObject({ date: "2026-10-19", kcal: 1730, protein: 68, waterMl: 1500, weightKg: 80.4, onTarget: true });
    expect(r.days[1]).toMatchObject({ date: "2026-10-20", kcal: 2100, cardioMin: 40, onTarget: false });
    expect(r.days[2]).toMatchObject({ date: "2026-10-21", kcal: null, onTarget: null });
    expect(r.averages).toMatchObject({ kcal: 1915, protein: 69 });
    expect(r.daysOnTarget).toBe(1);
    expect(r.weight).toEqual({ start: 80.4, end: 79.6, change: -0.8 });
    expect(r.meals[0]).toEqual({
      date: "2026-10-19",
      mealType: "breakfast",
      mealLabel: "Kahvaltı",
      items: [{ time: "08:00", name: "Yulaf", grams: 60, kcal: 230, protein: 8 }],
    });
    expect(r.supplements).toEqual([{ name: "D Vitamini", dose: "1000 IU", takenDays: 1 }]);
  });

  it("geçersiz ya da 92 günden uzun aralık 400", async () => {
    expect((await callRoute(GET, { query: { from: "2026-10-25", to: "2026-10-19" } })).status).toBe(400);
    expect((await callRoute(GET, { query: { from: "2026-01-01", to: "2026-10-19" } })).status).toBe(400);
    expect((await callRoute(GET, { query: { from: "dün" } })).status).toBe(400);
  });

  it("Excel dosyası üç sayfa içerir ve bir kopyası uygulama klasörüne yazılır", async () => {
    await seed();
    // İkili içerik: yardımcı metne çevirdiği için işleyici doğrudan çağrılır.
    const res = await XLSX_GET(new NextRequest("http://127.0.0.1:3005/api/reports/dietitian/xlsx?from=2026-10-19&to=2026-10-25"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    expect(res.headers.get("content-disposition")).toContain("rutinfit-diyetisyen-raporu-2026-10-19_2026-10-25.xlsx");
    expect(decodeURIComponent(res.headers.get("x-rutinfit-export-path") ?? "")).toContain("exports");
    const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
    expect(wb.SheetNames).toEqual(["Özet", "Günlük", "Öğün günlüğü"]);
    const daily = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Günlük"]);
    expect(daily[0]).toMatchObject({ Tarih: "2026-10-19", Kalori: 1730, "Protein (g)": 68 });
  });
});
