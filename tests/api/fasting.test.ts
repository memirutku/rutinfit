import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/fasting/route";
import { PUT as SETTINGS } from "@/app/api/fasting/settings/route";
import { POST as START } from "@/app/api/fasting/start/route";
import { POST as STOP } from "@/app/api/fasting/stop/route";
import { dueReminders } from "@/lib/services/reminders";
import { getFastingStatus } from "@/lib/services/fasting";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createProfile } from "../helpers/factories";

beforeEach(resetDatabase);

describe("/api/fasting (F14 + F76)", () => {
  it("ayarlar kaydedilir; bilinmeyen il ve geçersiz süre 400", async () => {
    await createProfile();
    const res = await callRoute(SETTINGS, { method: "PUT", body: { ramadanMode: true, ramadanProvince: "Ankara", ramadanIftarAdjust: 1, fastingTargetHours: 16 } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ ramadanMode: true, ramadanProvince: "Ankara", ramadanImsakAdjust: 0, ramadanIftarAdjust: 1, fastingTargetHours: 16 });
    expect((await callRoute(SETTINGS, { method: "PUT", body: { ramadanProvince: "Atlantis" } })).status).toBe(400);
    expect((await callRoute(SETTINGS, { method: "PUT", body: { fastingTargetHours: 40 } })).status).toBe(400);
    expect((await callRoute(SETTINGS, { method: "PUT", body: { ramadanIftarAdjust: 90 } })).status).toBe(400);
  });

  it("Ramazan modunda bugünün ve yarının vakitleri, aşama ve kalan süre döner", async () => {
    await createProfile({ ramadanMode: true, ramadanProvince: "Ankara" });
    const morning = await getFastingStatus(new Date("2026-02-19T04:00:00+03:00"));
    expect(morning.ramadan).toMatchObject({ province: "Ankara", today: { imsak: "06:06", iftar: "18:35" }, phase: "sahur", minutesLeft: 126 });
    const noon = await getFastingStatus(new Date("2026-02-19T12:35:00+03:00"));
    expect(noon.ramadan).toMatchObject({ phase: "fasting", minutesLeft: 360 });
    expect(noon.ramadan!.progressPercent).toBe(52);
    const night = await getFastingStatus(new Date("2026-02-19T21:00:00+03:00"));
    expect(night.ramadan).toMatchObject({ phase: "evening", tomorrow: { date: "2026-02-20" } });

    const off = await (async () => {
      await prisma.userProfile.update({ where: { id: "default-user" }, data: { ramadanMode: false } });
      return callRoute(GET);
    })();
    expect(off.json.ramadan).toBeNull();
  });

  it("aralıklı oruç: başlat, ikinci kez başlatma 409, bitir; geçmişte süre ve hedef tutması", async () => {
    await createProfile({ fastingTargetHours: 16 });
    const start = await callRoute(START, { body: {} });
    expect(start.status).toBe(201);
    expect(start.json).toMatchObject({ targetHours: 16, endedAt: null });
    expect((await callRoute(START, { body: { targetHours: 18 } })).status).toBe(409);

    // 17 saat önce başlamış gibi
    await prisma.fastingSession.update({ where: { id: start.json.id }, data: { startedAt: new Date(Date.now() - 17 * 3600_000) } });
    const status = await callRoute(GET);
    expect(status.json.timer.active).toMatchObject({ targetHours: 16 });
    expect(status.json.timer.active.elapsedMinutes).toBeGreaterThanOrEqual(17 * 60 - 1);

    const stop = await callRoute(STOP, { body: {} });
    expect(stop.status).toBe(200);
    const after = await callRoute(GET);
    expect(after.json.timer.active).toBeNull();
    expect(after.json.timer.recent[0]).toMatchObject({ targetHours: 16, reachedTarget: true });
    expect((await callRoute(STOP, { body: {} })).status).toBe(404);
  });

  it("B26: Ramazan dışında kalan gün döner; su hatırlatması oruç saatinde de susturulmaz", async () => {
    await createProfile({ ramadanMode: true, ramadanProvince: "İstanbul", waterTargetMl: 2500 });
    const inside = await getFastingStatus(new Date("2026-02-19T12:00:00+03:00"));
    expect(inside.ramadan!.period).toMatchObject({ inRamadan: true, day: 1 });
    const outside = await getFastingStatus(new Date("2026-10-30T12:00:00+03:00"));
    expect(outside.ramadan!.period).toMatchObject({ inRamadan: false, start: "2027-02-08", daysUntil: 101 });
    await prisma.reminder.create({ data: { kind: "water", title: "Su iç", time: "12:00" } });
    expect((await dueReminders(new Date(2026, 9, 30, 12, 10))).map((d) => d.title)).toEqual(["Su iç"]);
  });

  it("Ramazan modunda oruç saatlerinde su hatırlatması gelmez, iftardan sonra gelir", async () => {
    await createProfile({ ramadanMode: true, ramadanProvince: "Ankara", waterTargetMl: 2500 });
    await prisma.reminder.create({ data: { kind: "water", title: "Su iç", time: "12:00" } });
    await prisma.reminder.create({ data: { kind: "water", title: "Akşam suyu", time: "19:00" } });
    expect(await dueReminders(new Date(2026, 1, 19, 12, 10))).toEqual([]);
    expect((await dueReminders(new Date(2026, 1, 19, 19, 10))).map((d) => d.title)).toEqual(["Akşam suyu"]);
  });
});
