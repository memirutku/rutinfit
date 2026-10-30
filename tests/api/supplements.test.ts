import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST, PATCH, DELETE } from "@/app/api/supplements/route";
import { POST as LOG } from "@/app/api/supplements/log/route";
import { GET as PROGRESS } from "@/app/api/progress/route";
import { GET as FOOD_LOGS } from "@/app/api/food-logs/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

describe("/api/supplements (F15)", () => {
  it("takviye eklenir; aynı ad 409; geçersiz birim ve doz 400", async () => {
    const res = await callRoute(POST, { body: { name: "D Vitamini", doseAmount: 1000, doseUnit: "IU" } });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ name: "D Vitamini", doseAmount: 1000, doseUnit: "IU", active: true });
    expect((await callRoute(POST, { body: { name: "d vitamini", doseAmount: 2000, doseUnit: "IU" } })).status).toBe(409);
    expect((await callRoute(POST, { body: { name: "Omega 3", doseAmount: 1, doseUnit: "kova" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { name: "Omega 3", doseAmount: 0, doseUnit: "kapsül" } })).status).toBe(400);
  });

  it("günlük işaretleme kayda dozu ve birimi yazar; liste bugünü ve son 7 günü gösterir", async () => {
    const omega = (await callRoute(POST, { body: { name: "Omega 3", doseAmount: 2, doseUnit: "kapsül" } })).json;
    await callRoute(LOG, { body: { supplementId: omega.id, date: "2026-10-28", taken: true } });
    const res = await callRoute(LOG, { body: { supplementId: omega.id, date: "2026-10-30", taken: true } });
    expect(res.status).toBe(200);
    const row = await prisma.supplementLog.findUnique({ where: { date_name: { date: "2026-10-30", name: "Omega 3" } } });
    expect(row).toMatchObject({ taken: true, doseGrams: 2, doseUnit: "kapsül" });

    const list = await callRoute(GET, { query: { date: "2026-10-30" } });
    expect(list.json.supplements[0]).toMatchObject({ name: "Omega 3", takenToday: true, takenLast7: 2 });

    await callRoute(LOG, { body: { supplementId: omega.id, date: "2026-10-30", taken: false } });
    const after = await callRoute(GET, { query: { date: "2026-10-30" } });
    expect(after.json.supplements[0]).toMatchObject({ takenToday: false, takenLast7: 1 });
    expect((await callRoute(LOG, { body: { supplementId: "yok", date: "2026-10-30", taken: true } })).status).toBe(404);
  });

  it("kreatin bu listeden işaretlenince ilerleme ekranı da görür", async () => {
    const creatine = (await callRoute(POST, { body: { name: "Kreatin Monohidrat", doseAmount: 5, doseUnit: "g" } })).json;
    const today = new Intl.DateTimeFormat("sv-SE").format(new Date());
    await callRoute(LOG, { body: { supplementId: creatine.id, date: today, taken: true } });
    const progress = await callRoute(PROGRESS);
    expect(progress.json.today.creatineTaken).toBe(true);
  });

  it("güncelleme, pasifleştirme ve silme; silinen takviyenin geçmiş kayıtları kalır", async () => {
    const mg = (await callRoute(POST, { body: { name: "Magnezyum", doseAmount: 200, doseUnit: "mg" } })).json;
    await callRoute(LOG, { body: { supplementId: mg.id, date: "2026-10-30", taken: true } });
    const upd = await callRoute(PATCH, { method: "PATCH", query: { id: mg.id }, body: { doseAmount: 300, active: false, notes: "Yatmadan önce" } });
    expect(upd.json).toMatchObject({ doseAmount: 300, active: false, notes: "Yatmadan önce" });
    expect((await callRoute(DELETE, { method: "DELETE", query: { id: mg.id } })).status).toBe(200);
    expect(await prisma.supplement.count()).toBe(0);
    expect(await prisma.supplementLog.count()).toBe(1);
    expect((await callRoute(DELETE, { method: "DELETE", query: { id: mg.id } })).status).toBe(404);
  });

  it("B12: besin değeri olan takviye işaretlenince günlüğe yazılır; geri alınınca silinir", async () => {
    const today = new Intl.DateTimeFormat("sv-SE").format(new Date());
    const whey = (await callRoute(POST, { body: { name: "Whey Protein", doseAmount: 30, doseUnit: "g", caloriesPerDose: 120, proteinPerDose: 24 } })).json;
    expect(whey).toMatchObject({ caloriesPerDose: 120, proteinPerDose: 24 });

    await callRoute(LOG, { body: { supplementId: whey.id, date: today, taken: true } });
    // İkinci "alındı" işareti ikinci kayıt açmaz.
    await callRoute(LOG, { body: { supplementId: whey.id, date: today, taken: true } });
    const logs = await prisma.foodLog.findMany({ where: { date: today } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ name: "Whey Protein (30 g)", grams: 30, caloriesSnapshot: 120, proteinSnapshot: 24, carbsSnapshot: 0, fatSnapshot: 0 });
    const day = await callRoute(FOOD_LOGS, { query: { date: today } });
    expect(day.json.summary.consumedProtein).toBe(24);
    const list = await callRoute(GET, { query: { date: today } });
    expect(list.json.supplements[0]).toMatchObject({ caloriesPerDose: 120, proteinPerDose: 24, takenToday: true });

    await callRoute(LOG, { body: { supplementId: whey.id, date: today, taken: false } });
    expect(await prisma.foodLog.count()).toBe(0);
    expect(await prisma.supplementLog.findFirst({ where: { name: "Whey Protein" } })).toMatchObject({ taken: false, foodLogId: null });
  });

  it("B12: besin değeri olmayan takviye günlüğe yazılmaz; kullanıcının sildiği öğün geri almayı bozmaz", async () => {
    const vitd = (await callRoute(POST, { body: { name: "D Vitamini", doseAmount: 1000, doseUnit: "IU" } })).json;
    await callRoute(LOG, { body: { supplementId: vitd.id, date: "2026-10-30", taken: true } });
    expect(await prisma.foodLog.count()).toBe(0);

    const gainer = (await callRoute(POST, { body: { name: "Gainer", doseAmount: 1, doseUnit: "ölçek", caloriesPerDose: 380 } })).json;
    // Geçmiş bir gün için işaretlenen takviye "ara öğün" olarak yazılır.
    await callRoute(LOG, { body: { supplementId: gainer.id, date: "2026-10-01", taken: true } });
    const log = await prisma.foodLog.findFirstOrThrow();
    expect(log).toMatchObject({ name: "Gainer (1 ölçek)", caloriesSnapshot: 380, proteinSnapshot: 0, mealType: "extra" });
    await prisma.foodLog.delete({ where: { id: log.id } });
    expect((await callRoute(LOG, { body: { supplementId: gainer.id, date: "2026-10-01", taken: false } })).status).toBe(200);

    // Besin değeri sonradan kaldırılabilir.
    const upd = await callRoute(PATCH, { method: "PATCH", query: { id: gainer.id }, body: { caloriesPerDose: null } });
    expect(upd.json.caloriesPerDose).toBeNull();
    expect((await callRoute(POST, { body: { name: "X", doseAmount: 1, doseUnit: "g", proteinPerDose: -1 } })).status).toBe(400);
  });
});
