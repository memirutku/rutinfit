import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/reports/dietitian/route";
import { GET as XLSX_GET } from "@/app/api/reports/dietitian/xlsx/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood, createMealPlan, createProfile, createRecipe } from "../helpers/factories";
import { compareToTarget } from "@/lib/services/dietitian-report";

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

  it("Excel dosyası altı sayfa içerir ve bir kopyası uygulama klasörüne yazılır", async () => {
    await seed();
    // İkili içerik: yardımcı metne çevirdiği için işleyici doğrudan çağrılır.
    const res = await XLSX_GET(new NextRequest("http://127.0.0.1:3005/api/reports/dietitian/xlsx?from=2026-10-19&to=2026-10-25"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    expect(res.headers.get("content-disposition")).toContain("rutinfit-diyetisyen-raporu-2026-10-19_2026-10-25.xlsx");
    expect(decodeURIComponent(res.headers.get("x-rutinfit-export-path") ?? "")).toContain("exports");
    const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
    expect(wb.SheetNames).toEqual(["Özet", "Günlük", "Öğün günlüğü", "Ölçüler", "Plana uyum", "Plan ve gerçekleşen"]);
    const daily = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Günlük"]);
    expect(daily[0]).toMatchObject({ Tarih: "2026-10-19", Kalori: 1730, "Protein (g)": 68 });
  });
});

/** B43: Zeynep'in iki haftası: ölçüler, plan ve uyum. 2026-10-19 Pazartesi. */
async function seedPlanWeeks() {
  await createProfile({ sex: "female", calorieTarget: 1500, calorieCeiling: 1600, proteinTargetG: 122, carbTargetG: 131, fatTargetG: 42 });
  await prisma.bodyMeasurement.create({ data: { date: "2026-10-10", waistCm: 95 } }); // aralık dışı
  await prisma.bodyMeasurement.create({ data: { date: "2026-10-20", waistCm: 93, hipCm: 108 } });
  await prisma.bodyMeasurement.create({ data: { date: "2026-10-27", waistCm: 92.5 } });
  await prisma.bodyMeasurement.create({ data: { date: "2026-10-30", waistCm: 91, hipCm: 107, restingHr: 64 } });

  const bulgur = await createFood({ name: "Bulgur", calories: 200, proteinG: 10, carbsG: 30, fatG: 5 });
  const pilav = await createRecipe([{ foodItemId: bulgur.id, grams: 200 }], { name: "Bulgur Pilavı" }); // 400 kcal
  const week1 = await createMealPlan("2026-10-20", [
    { mealType: "breakfast", customName: "2 yumurta, 1 dilim ekmek" },
    { mealType: "lunch", recipeId: pilav.id },
  ]);
  const week2 = await createMealPlan("2026-10-28", [{ mealType: "dinner", customName: "Taze fasulye" }]);
  await prisma.plannedMeal.update({ where: { id: week1.meals[0].id }, data: { adherence: "done" } });
  await prisma.plannedMeal.update({ where: { id: week1.meals[1].id }, data: { adherence: "partial" } });
  await prisma.plannedMeal.update({ where: { id: week2.meals[0].id }, data: { adherence: "skipped" } });

  await log("2026-10-20", "08:00", "breakfast", "Yumurta", 120, 310, 20);
  await log("2026-10-20", "12:30", "lunch", "Bulgur Pilavı", 300, 600, 15);
  await log("2026-10-20", "16:00", "extra", "Muz", 120, 105, 1);
  await log("2026-10-21", "08:00", "breakfast", "Simit", 100, 1500, 30);
}

describe("B43: diyetisyenin baktığı veriler", () => {
  it("ölçü tablosu: dönemdeki ilk ve son değer, fark; bel/kalça oranı", async () => {
    await seedPlanWeeks();
    const r = (await callRoute(GET, { query: { from: "2026-10-17", to: "2026-10-30" } })).json;
    const byKey = Object.fromEntries(r.measurements.map((m: { key: string }) => [m.key, m]));
    expect(byKey.waistCm).toEqual({ key: "waistCm", label: "Bel", unit: "cm", first: { date: "2026-10-20", value: 93 }, last: { date: "2026-10-30", value: 91 }, change: -2, count: 3 });
    expect(byKey.hipCm).toMatchObject({ first: { date: "2026-10-20", value: 108 }, last: { date: "2026-10-30", value: 107 }, change: -1 });
    expect(byKey.restingHr).toMatchObject({ first: { value: 64 }, last: { value: 64 }, change: null, count: 1 });
    expect(byKey.waistHipRatio).toMatchObject({ label: "Bel/kalça oranı", first: { value: 0.86 }, last: { value: 0.85 }, change: -0.01 });
    expect(byKey.chestCm).toBeUndefined();
  });

  it("haftalık plana uyum yüzdesi (uygulandı 1, kısmen 0,5, atlandı 0)", async () => {
    await seedPlanWeeks();
    const r = (await callRoute(GET, { query: { from: "2026-10-17", to: "2026-10-30" } })).json;
    expect(r.adherence.overall).toMatchObject({ planned: 3, marked: 3, percent: 50 });
    expect(r.adherence.weeks).toEqual([
      expect.objectContaining({ weekStart: "2026-10-12", from: "2026-10-17", to: "2026-10-18", planned: 0, percent: null }),
      expect.objectContaining({ weekStart: "2026-10-19", from: "2026-10-19", to: "2026-10-25", planned: 2, done: 1, partial: 1, percent: 75 }),
      expect.objectContaining({ weekStart: "2026-10-26", from: "2026-10-26", to: "2026-10-30", planned: 1, skipped: 1, percent: 0 }),
    ]);
  });

  it("öğün bazında plan ve gerçekleşen: planlı kalori, kaydedilen kalori, uyum; plan dışı öğün ayrı", async () => {
    await seedPlanWeeks();
    const r = (await callRoute(GET, { query: { from: "2026-10-17", to: "2026-10-30" } })).json;
    expect(r.planVsActual).toEqual([
      { date: "2026-10-20", mealType: "breakfast", mealLabel: "Kahvaltı", planned: "2 yumurta, 1 dilim ekmek", plannedKcal: null, actualKcal: 310, actualCount: 1, diffKcal: null, adherence: "done" },
      { date: "2026-10-20", mealType: "lunch", mealLabel: "Öğle Yemeği", planned: "Bulgur Pilavı", plannedKcal: 400, actualKcal: 600, actualCount: 1, diffKcal: 200, adherence: "partial" },
      expect.objectContaining({ date: "2026-10-20", mealType: "extra", planned: null, plannedKcal: null, actualKcal: 105, adherence: null }),
      expect.objectContaining({ date: "2026-10-28", mealType: "dinner", planned: "Taze fasulye", actualKcal: null, actualCount: 0, adherence: "skipped" }),
    ]);
  });

  it("özet: ortalamalar hedefle karşılaştırılır ve sapma derecelenir", async () => {
    await seedPlanWeeks();
    const r = (await callRoute(GET, { query: { from: "2026-10-17", to: "2026-10-30" } })).json;
    // 2 kayıtlı gün: (1015 + 1500) / 2 = 1258 kcal; protein (36 + 30) / 2 = 33 g
    expect(r.targets.kcal).toMatchObject({ avg: 1258, target: 1500, diff: -242, diffPct: -16, status: "warn" });
    expect(r.targets.protein).toMatchObject({ avg: 33, target: 122, status: "off" });
  });

  it("sapma derecesi: kalori tavanı aşınca, protein hedefin altında kalınca işaretlenir", () => {
    expect(compareToTarget("kcal", 1450, 1500, 1600)?.status).toBe("ok");
    expect(compareToTarget("kcal", 1650, 1500, 1600)?.status).toBe("warn");
    expect(compareToTarget("kcal", 1900, 1500, 1600)?.status).toBe("off");
    expect(compareToTarget("kcal", 1100, 1500, 1600)?.status).toBe("off");
    expect(compareToTarget("protein", 115, 122)?.status).toBe("ok");
    expect(compareToTarget("protein", 200, 122)?.status).toBe("ok");
    expect(compareToTarget("protein", 95, 122)?.status).toBe("warn");
    expect(compareToTarget("fat", 60, 42)?.status).toBe("off");
    expect(compareToTarget("carbs", 140, 131)?.status).toBe("ok");
    expect(compareToTarget("carbs", null, 131)).toBeNull();
    expect(compareToTarget("carbs", 100, 0)).toBeNull();
  });

  it("Excel: ölçüler, haftalık uyum ve plan–gerçekleşen sayfaları; özette hedeften fark", async () => {
    await seedPlanWeeks();
    const res = await XLSX_GET(new NextRequest("http://127.0.0.1:3005/api/reports/dietitian/xlsx?from=2026-10-17&to=2026-10-30"));
    const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
    const rows = (name: string) => XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]);
    expect(rows("Ölçüler")).toContainEqual(expect.objectContaining({ Ölçü: "Bel (cm)", İlk: 93, "İlk tarih": "2026-10-20", Son: 91, "Son tarih": "2026-10-30", Fark: -2 }));
    expect(rows("Plana uyum")).toContainEqual(expect.objectContaining({ Başlangıç: "2026-10-19", Bitiş: "2026-10-25", "Planlı öğün": 2, "Uyum (%)": 75 }));
    expect(rows("Plan ve gerçekleşen")).toContainEqual(
      expect.objectContaining({ Tarih: "2026-10-20", Öğün: "Öğle Yemeği", Plan: "Bulgur Pilavı", "Plan (kcal)": 400, "Gerçekleşen (kcal)": 600, Fark: 200, Uyum: "Kısmen" })
    );
    const summary = XLSX.utils.sheet_to_json<[string, unknown]>(wb.Sheets["Özet"], { header: 1 });
    expect(summary).toContainEqual(["Ortalama kalori: hedeften fark", "-242 kcal (hedefin %16 altında)"]);
    expect(summary).toContainEqual(["Ortalama protein: hedeften fark", "-89 g (hedefin %73 altında)"]);
    expect(summary).toContainEqual(["Plana uyum (dönem)", "%50"]);
  });
});
