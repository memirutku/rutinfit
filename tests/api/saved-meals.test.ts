import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "@/app/api/saved-meals/route";
import { POST as apply } from "@/app/api/saved-meals/apply/route";
import { POST as copy } from "@/app/api/food-logs/copy/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood } from "../helpers/factories";

beforeEach(resetDatabase);

async function log(date: string, mealType: string, name: string, grams: number, kcal: number, foodItemId?: string) {
  return prisma.foodLog.create({
    data: { date, time: "08:00", mealType, name, grams, foodItemId, caloriesSnapshot: kcal, proteinSnapshot: 10, carbsSnapshot: 20, fatSnapshot: 5 },
  });
}

describe("F01: kayıtlı öğünler", () => {
  it("günün öğününü kaydeder; liste kalem sayısını ve toplam kaloriyi verir", async () => {
    const oats = await createFood({ name: "Yulaf", calories: 370 });
    await log("2026-10-29", "breakfast", "Yulaf", 50, 185, oats.id);
    await log("2026-10-29", "breakfast", "Muz", 120, 107);
    await log("2026-10-29", "dinner", "Mercimek", 300, 350);

    const res = await callRoute(POST, { body: { name: "Sabah kasesi", date: "2026-10-29", mealType: "breakfast" } });
    expect(res.status).toBe(201);
    const list = (await callRoute(GET)).json;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Sabah kasesi", mealType: "breakfast", itemCount: 2, totalCalories: 292 });
  });

  it("kayıtlı öğünü bir güne ekler; katalog gıdası güncel değerle, serbest kalem kayıtlı değerle hesaplanır", async () => {
    const oats = await createFood({ name: "Yulaf", calories: 370 });
    await log("2026-10-29", "breakfast", "Yulaf", 50, 185, oats.id);
    await log("2026-10-29", "breakfast", "Muz", 120, 107);
    const saved = (await callRoute(POST, { body: { name: "Sabah", date: "2026-10-29", mealType: "breakfast" } })).json;
    await prisma.foodItem.update({ where: { id: oats.id }, data: { calories: 400 } });

    const res = await callRoute(apply, { body: { savedMealId: saved.id, date: "2026-10-30", mealType: "lunch", time: "12:30" } });
    expect(res.status).toBe(201);
    expect(res.json.created).toBe(2);
    const logs = await prisma.foodLog.findMany({ where: { date: "2026-10-30" }, orderBy: { name: "asc" } });
    expect(logs.map((l) => [l.name, l.mealType, l.time, l.caloriesSnapshot])).toEqual([
      ["Muz", "lunch", "12:30", 107],
      ["Yulaf", "lunch", "12:30", 200],
    ]);
  });

  it("boş öğün kaydedilemez (400); olmayan kayıtlı öğün 404; silinince listeden çıkar", async () => {
    expect((await callRoute(POST, { body: { name: "Boş", date: "2026-10-29", mealType: "lunch" } })).status).toBe(400);
    expect((await callRoute(apply, { body: { savedMealId: "yok", date: "2026-10-30" } })).status).toBe(404);
    await log("2026-10-29", "lunch", "Pilav", 200, 260);
    const saved = (await callRoute(POST, { body: { name: "Öğle", date: "2026-10-29", mealType: "lunch" } })).json;
    expect((await callRoute(DELETE, { method: "DELETE", query: { id: saved.id } })).status).toBe(200);
    expect((await callRoute(GET)).json).toHaveLength(0);
    expect(await prisma.savedMealItem.count()).toBe(0);
  });
});

describe("F01: öğün ve gün kopyalama", () => {
  it("bütün günü ya da tek öğünü kayıtlı değerleriyle kopyalar", async () => {
    await log("2026-10-29", "breakfast", "Yulaf", 50, 185);
    await log("2026-10-29", "breakfast", "Muz", 120, 107);
    await log("2026-10-29", "dinner", "Mercimek", 300, 350);

    const one = await callRoute(copy, { body: { fromDate: "2026-10-29", toDate: "2026-10-30", mealType: "breakfast" } });
    expect(one.json.copied).toBe(2);
    const all = await callRoute(copy, { body: { fromDate: "2026-10-29", toDate: "2026-10-31" } });
    expect(all.json.copied).toBe(3);
    const copied = await prisma.foodLog.findFirstOrThrow({ where: { date: "2026-10-31", name: "Mercimek" } });
    expect(copied).toMatchObject({ mealType: "dinner", caloriesSnapshot: 350, grams: 300 });
  });

  it("aynı güne kopyalama ve boş kaynak 400 döner", async () => {
    expect((await callRoute(copy, { body: { fromDate: "2026-10-29", toDate: "2026-10-29" } })).status).toBe(400);
    expect((await callRoute(copy, { body: { fromDate: "2026-10-01", toDate: "2026-10-02" } })).status).toBe(400);
  });
});
