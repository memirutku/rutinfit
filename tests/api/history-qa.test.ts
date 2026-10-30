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
    // B31: soru koşu hakkındaysa yürüyüş toplama girmez.
    expect((await answerHistoryQuestion("bu ay kaç km koştum", TODAY))!.answer).toMatch(/1 koşu · 30 dk · 5 km/);
  });

  it("kayıt yoksa bunu söyler; geçmiş sorusu değilse null", async () => {
    expect((await answerHistoryQuestion("son 7 günde kaç kalori aldım", TODAY))!.answer).toMatch(/kayıt yok/);
    expect(await answerHistoryQuestion("akşama ne pişireyim", TODAY)).toBeNull();
  });

  it("B31: koşu sorusu yalnız koşuyu toplar; genel kardiyo sorusu türlere ayrılır", async () => {
    await prisma.cardioLog.createMany({
      data: [
        { date: "2026-10-26", kind: "run", durationMin: 30, distanceKm: 5 },
        { date: "2026-10-27", kind: "walk", durationMin: 60, distanceKm: 5.5 },
        { date: "2026-10-28", kind: "cycle", durationMin: 45, distanceKm: 15 },
        { date: "2026-10-29", kind: "run", durationMin: 25, distanceKm: 4.2 },
      ],
    });
    const run = (await answerHistoryQuestion("Bu hafta kaç km koştum?", TODAY))!;
    expect(run.title).toBe("Koşu · Bu hafta");
    expect(run.answer).toBe("Bu hafta: 2 koşu · 55 dk · 9,2 km.");
    expect(run.rows).toEqual([
      { label: "26.10.2026", value: "Koşu · 30 dk · 5 km" },
      { label: "29.10.2026", value: "Koşu · 25 dk · 4,2 km" },
    ]);

    const all = (await answerHistoryQuestion("bu hafta toplam kaç km kardiyo yaptım", TODAY))!;
    expect(all.title).toBe("Kardiyo · Bu hafta");
    expect(all.answer).toBe("Bu hafta: 4 kardiyo · 160 dk · 29,7 km (Koşu 9,2 km · Yürüyüş 5,5 km · Bisiklet 15 km).");
    expect(all.rows).toHaveLength(4);
  });

  it("B31: istenen türde kayıt yoksa bunu söyler, diğer kardiyoyu ayrıca belirtir", async () => {
    await prisma.cardioLog.create({ data: { date: "2026-10-27", kind: "walk", durationMin: 60, distanceKm: 5.5 } });
    const run = (await answerHistoryQuestion("bu hafta kaç km koştum", TODAY))!;
    expect(run.answer).toBe("Bu hafta koşu kaydı yok. Diğer kardiyo: 1 yürüyüş · 5,5 km.");
  });
});
