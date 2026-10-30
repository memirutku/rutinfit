import { beforeEach, describe, expect, it } from "vitest";
import { answerHistoryQuestion } from "@/lib/services/history-qa";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { createProfile } from "../helpers/factories";

beforeEach(resetDatabase);
const TODAY = "2026-10-30";

async function log(date: string, name: string, kcal: number, protein: number) {
  await prisma.foodLog.create({ data: { date, time: "12:00", mealType: "lunch", name, grams: 100, caloriesSnapshot: kcal, proteinSnapshot: protein, carbsSnapshot: 0, fatSnapshot: 0 } });
}

describe("F50: geçmiş sorguları", () => {
  it("ortalama kalori ve protein: kayıtlı günlerin ortalaması, hedefle; kaynak satırları gün gün", async () => {
    await createProfile({ calorieTarget: 2000, proteinTargetG: 150 });
    await log("2026-10-27", "Yulaf", 1800, 120);
    await log("2026-10-28", "Mercimek", 1200, 60);
    await log("2026-10-28", "Tavuk", 1000, 90);
    const cal = await answerHistoryQuestion("bu hafta ortalama kaç kalori aldım", TODAY);
    expect(cal).toMatchObject({ type: "avg_calories", title: "Ortalama kalori · Bu hafta" });
    expect(cal!.answer).toMatch(/2 kayıtlı günde ortalama 2.000 kcal/);
    expect(cal!.answer).toMatch(/hedef 2.000/);
    expect(cal!.rows).toEqual([{ label: "27.10.2026", value: "1.800 kcal" }, { label: "28.10.2026", value: "2.200 kcal" }]);
    const pro = await answerHistoryQuestion("bu hafta proteinim nasıldı", TODAY);
    expect(pro!.answer).toMatch(/ortalama 135 g/);
  });

  it("kilo değişimi, antrenman sayısı, rekor, en çok yenenler, su ve kardiyo", async () => {
    await prisma.weightLog.createMany({ data: [{ date: "2026-10-01", weightKg: 110 }, { date: "2026-10-29", weightKg: 107.5 }] });
    await prisma.workoutSession.create({
      data: { date: "2026-10-20", name: "A", setLogs: { create: [{ exerciseName: "Bench Press", setNumber: 1, weightKg: 80, reps: 8 }, { exerciseName: "Bench Press", setNumber: 2, weightKg: 85, reps: 5 }] } },
    });
    await prisma.workoutSession.create({ data: { date: "2026-10-25", name: "B", completed: false } });
    await log("2026-10-10", "Yulaf", 300, 10);
    await log("2026-10-11", "Yulaf", 300, 10);
    await log("2026-10-11", "Muz", 100, 1);
    await prisma.drinkLog.createMany({ data: [{ date: "2026-10-29", kind: "water", name: "Su", ml: 1500 }, { date: "2026-10-29", kind: "tea", name: "Çay", ml: 200 }] });
    await prisma.cardioLog.createMany({ data: [{ date: "2026-10-05", kind: "run", durationMin: 30, distanceKm: 5 }, { date: "2026-10-12", kind: "walk", durationMin: 60, distanceKm: 5.5 }] });

    expect((await answerHistoryQuestion("bu ay kaç kilo verdim", TODAY))!.answer).toMatch(/110 kg → 107,5 kg \(−2,5 kg\)/);
    expect((await answerHistoryQuestion("bu ay kaç antrenman yaptım", TODAY))!.answer).toMatch(/1 antrenman/);
    const pr = await answerHistoryQuestion("bench press rekorum ne", TODAY);
    expect(pr!.answer).toMatch(/Bench Press/);
    expect(pr!.answer).toMatch(/101,3 kg/);
    expect((await answerHistoryQuestion("bu ay en çok ne yemişim", TODAY))!.rows[0]).toEqual({ label: "Yulaf", value: "2 kez" });
    expect((await answerHistoryQuestion("dün ne kadar su içtim", TODAY))!.answer).toMatch(/1.700 ml/);
    expect((await answerHistoryQuestion("bu ay kaç km koştum", TODAY))!.answer).toMatch(/2 kardiyo · 90 dk · 10,5 km/);
  });

  it("kayıt yoksa bunu söyler; geçmiş sorusu değilse null", async () => {
    expect((await answerHistoryQuestion("son 7 günde kaç kalori aldım", TODAY))!.answer).toMatch(/kayıt yok/);
    expect(await answerHistoryQuestion("akşama ne pişireyim", TODAY)).toBeNull();
  });
});
