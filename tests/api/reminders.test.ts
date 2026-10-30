import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST, PATCH, DELETE } from "@/app/api/reminders/route";
import { POST as FIRED } from "@/app/api/reminders/fired/route";
import { dueReminders } from "@/lib/services/reminders";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createProfile } from "../helpers/factories";

beforeEach(resetDatabase);

// 30 Ekim 2026 Cuma, yerel saatle 10:30
const NOW = new Date(2026, 9, 30, 10, 30);
const TODAY = "2026-10-30";

const add = async (body: Record<string, unknown>) => {
  const res = await callRoute(POST, { body });
  expect(res.status).toBe(201);
  return res.json;
};

describe("/api/reminders (F83)", () => {
  it("türüne göre varsayılan başlık; geçersiz saat, gün ve eksik bağlantı 400", async () => {
    expect(await add({ kind: "water", time: "10:00" })).toMatchObject({ title: "Su iç", days: "1234567", enabled: true });
    expect(await add({ kind: "meal", time: "12:30", mealType: "lunch" })).toMatchObject({ title: "Öğle Yemeği zamanı" });
    const supp = await prisma.supplement.create({ data: { name: "Omega 3", doseAmount: 2, doseUnit: "kapsül" } });
    expect(await add({ kind: "supplement", time: "09:00", supplementId: supp.id })).toMatchObject({ title: "Omega 3 al" });

    expect((await callRoute(POST, { body: { kind: "water", time: "25:00" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { kind: "water", time: "10:00", days: "189" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { kind: "water", time: "10:00", days: "" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { kind: "meal", time: "12:00" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { kind: "supplement", time: "12:00" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { kind: "supplement", time: "12:00", supplementId: "yok" } })).status).toBe(404);
    expect((await callRoute(POST, { body: { kind: "custom", time: "12:00" } })).status).toBe(400);

    const list = await callRoute(GET);
    expect(list.json.reminders.map((r: any) => r.time)).toEqual(["09:00", "10:00", "12:30"]);
  });

  it("vakti gelen, bugün geçerli ve yapılmamış olanlar gösterilir; bayatlar ve yapılanlar atlanır", async () => {
    await createProfile({ waterTargetMl: 2500 });
    const water = await add({ kind: "water", time: "10:00" });
    await add({ kind: "weigh", time: "07:00" }); // 60 dk'dan eski: atlanır
    await add({ kind: "custom", title: "Esneme", time: "10:45" }); // henüz değil
    await add({ kind: "custom", title: "Hafta sonu", time: "10:00", days: "67" }); // bugün Cuma
    await add({ kind: "custom", title: "Kapalı", time: "10:00", enabled: false });
    const creatine = await prisma.supplement.create({ data: { name: "Kreatin Monohidrat", doseAmount: 5, doseUnit: "g" } });
    const omega = await prisma.supplement.create({ data: { name: "Omega 3", doseAmount: 2, doseUnit: "kapsül" } });
    await add({ kind: "supplement", time: "10:10", supplementId: creatine.id });
    const omegaReminder = await add({ kind: "supplement", time: "10:10", supplementId: omega.id });
    await prisma.supplementLog.create({ data: { date: TODAY, name: "Kreatin Monohidrat", taken: true } });
    await add({ kind: "meal", time: "10:20", mealType: "breakfast" });
    await prisma.foodLog.create({
      data: { date: TODAY, time: "08:00", mealType: "breakfast", name: "Yumurta", grams: 100, caloriesSnapshot: 143, proteinSnapshot: 12, carbsSnapshot: 1, fatSnapshot: 10 },
    });
    await prisma.drinkLog.create({ data: { date: TODAY, time: "09:00", kind: "water", name: "Su", ml: 500 } });

    const due = await dueReminders(NOW);
    expect(due.map((d) => d.title).sort()).toEqual(["Omega 3 al", "Su iç"]);
    expect(due.find((d) => d.id === water.id)?.body).toBe("Bugün 500 / 2.500 ml içtin.");
    expect(due.find((d) => d.id === omegaReminder.id)?.body).toBe("2 kapsül Omega 3");

    // Gösterildi olarak işaretlenen aynı gün tekrar gelmez.
    expect((await callRoute(FIRED, { body: { ids: [water.id], date: TODAY } })).status).toBe(200);
    expect((await dueReminders(NOW)).map((d) => d.id)).toEqual([omegaReminder.id]);
    // Ertesi gün yeniden gelir.
    const nextDay = new Date(2026, 9, 31, 10, 30);
    expect((await dueReminders(nextDay)).map((d) => d.id)).toContain(water.id);
  });

  it("su hedefine ulaşıldıysa su hatırlatması atlanır; tartı girildiyse tartı hatırlatması atlanır", async () => {
    await createProfile({ waterTargetMl: 1000 });
    await add({ kind: "water", time: "10:00" });
    await add({ kind: "weigh", time: "10:00" });
    await prisma.drinkLog.create({ data: { date: TODAY, time: "09:00", kind: "tea", name: "Çay", ml: 1000 } });
    await prisma.weightLog.create({ data: { date: TODAY, weightKg: 100 } });
    expect(await dueReminders(NOW)).toEqual([]);
  });

  it("güncelleme ve silme; takviye silinince hatırlatması da silinir", async () => {
    const r = await add({ kind: "water", time: "10:00" });
    const upd = await callRoute(PATCH, { method: "PATCH", query: { id: r.id }, body: { time: "11:15", enabled: false } });
    expect(upd.json).toMatchObject({ time: "11:15", enabled: false });
    expect((await callRoute(PATCH, { method: "PATCH", query: { id: r.id }, body: { time: "9" } })).status).toBe(400);
    expect((await callRoute(DELETE, { method: "DELETE", query: { id: r.id } })).status).toBe(200);
    expect((await callRoute(DELETE, { method: "DELETE", query: { id: r.id } })).status).toBe(404);

    const { DELETE: deleteSupplement } = await import("@/app/api/supplements/route");
    const supp = await prisma.supplement.create({ data: { name: "Magnezyum", doseAmount: 200, doseUnit: "mg" } });
    await add({ kind: "supplement", time: "21:00", supplementId: supp.id });
    await callRoute(deleteSupplement, { method: "DELETE", query: { id: supp.id } });
    expect(await prisma.reminder.count()).toBe(0);
  });

  it("B26: sahur ve iftar hatırlatması imsak/iftara göre kayar; yalnız Ramazan modunda ve Ramazan günlerinde gelir", async () => {
    await createProfile({ ramadanMode: true, ramadanProvince: "Ankara" });
    const sahur = await add({ kind: "sahur", offsetMinutes: 45 });
    const iftar = await add({ kind: "iftar", offsetMinutes: 15 });
    expect(sahur).toMatchObject({ title: "Sahur vakti yaklaşıyor", relative: { anchor: "imsak", offsetMinutes: 45 } });
    expect(iftar).toMatchObject({ title: "İftara az kaldı", relative: { anchor: "iftar", offsetMinutes: 15 } });
    expect((await callRoute(POST, { body: { kind: "sahur", offsetMinutes: 500 } })).status).toBe(400);

    // 19 Şubat 2026 Ankara: imsak 06:06, iftar 18:35
    expect((await dueReminders(new Date(2026, 1, 19, 5, 0))).map((d) => d.id)).toEqual([]);
    const atSahur = await dueReminders(new Date(2026, 1, 19, 5, 25));
    expect(atSahur.map((d) => d.id)).toEqual([sahur.id]);
    expect(atSahur[0].body).toContain("İmsak 06:06");
    expect((await dueReminders(new Date(2026, 1, 19, 18, 25))).map((d) => d.id)).toEqual([iftar.id]);

    // Ramazan dışında ve mod kapalıyken gelmez.
    expect(await dueReminders(new Date(2026, 9, 30, 17, 55))).toEqual([]);
    await prisma.userProfile.update({ where: { id: "default-user" }, data: { ramadanMode: false } });
    expect(await dueReminders(new Date(2026, 1, 19, 18, 25))).toEqual([]);
  });
});
