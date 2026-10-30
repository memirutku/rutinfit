import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/progress/route";
import { POST as CHECKIN } from "@/app/api/checkins/route";
import { prisma } from "@/lib/prisma";
import { addDaysToDateString, getLocalDateString, startOfWeek } from "@/lib/date-utils";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createProfile } from "../helpers/factories";

beforeEach(resetDatabase);

describe("F82: döngü notu", () => {
  it("günlük ritimle kaydedilir, bugünün verisinde döner; null siler; geçersiz değer 400", async () => {
    const today = getLocalDateString();
    expect((await callRoute(POST, { body: { date: today, cycleNote: "period_start" } })).status).toBe(200);
    expect((await callRoute(GET)).json.today.cycleNote).toBe("period_start");
    await callRoute(POST, { body: { date: today, cycleNote: null } });
    expect((await callRoute(GET)).json.today.cycleNote).toBeNull();
    expect((await callRoute(POST, { body: { date: today, cycleNote: "pms" } })).status).toBe(400);
  });

  it("haftalık değerlendirmeye kodla not eklenir; döngü bilgisi modele gönderilmez; kapalıysa eklenmez", async () => {
    await createProfile({ cycleTracking: true });
    await prisma.aISettings.create({ data: { id: "default-ai", coachEnabled: false } });
    const weekStart = addDaysToDateString(startOfWeek(getLocalDateString()), -7);
    for (const i of [1, 2]) {
      await prisma.dailyWellbeing.create({ data: { date: addDaysToDateString(weekStart, i), cycleNote: i === 1 ? "period_start" : "period" } });
    }
    const res = await callRoute(CHECKIN, { method: "POST" });
    expect(res.json.summary).toMatch(/adet dönemi \(2 gün\)/);
    expect(res.json.metrics.cycleDays).toBe(2);

    await prisma.userProfile.update({ where: { id: "default-user" }, data: { cycleTracking: false } });
    const off = await callRoute(CHECKIN, { method: "POST" });
    expect(off.json.summary).not.toMatch(/adet/);
    expect(off.json.metrics.cycleDays).toBeNull();
  });
});
