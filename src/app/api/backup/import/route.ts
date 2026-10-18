import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const json = await req.json();

    if (!json.data) {
      return NextResponse.json(
        { error: "Geçersiz yedek dosyası formatı" },
        { status: 400 }
      );
    }

    const { data } = json;

    // Profil güncelle
    if (data.profile) {
      await prisma.userProfile.upsert({
        where: { id: "default-user" },
        update: {
          heightCm: data.profile.heightCm,
          age: data.profile.age,
          sex: data.profile.sex,
          currentWeightKg: data.profile.currentWeightKg,
          calorieTarget: data.profile.calorieTarget,
          calorieCeiling: data.profile.calorieCeiling,
          proteinTargetG: data.profile.proteinTargetG,
          fatTargetG: data.profile.fatTargetG,
          carbTargetG: data.profile.carbTargetG,
          wakeTime: data.profile.wakeTime,
          workdayHomeTime: data.profile.workdayHomeTime,
        },
        create: {
          id: "default-user",
          heightCm: data.profile.heightCm,
          age: data.profile.age,
          sex: data.profile.sex,
          currentWeightKg: data.profile.currentWeightKg,
          calorieTarget: data.profile.calorieTarget,
          calorieCeiling: data.profile.calorieCeiling,
          proteinTargetG: data.profile.proteinTargetG,
          fatTargetG: data.profile.fatTargetG,
          carbTargetG: data.profile.carbTargetG,
          wakeTime: data.profile.wakeTime,
          workdayHomeTime: data.profile.workdayHomeTime,
        },
      });
    }

    // Besinler
    if (Array.isArray(data.foods)) {
      for (const f of data.foods) {
        await prisma.foodItem.upsert({
          where: { id: f.id },
          update: {
            name: f.name,
            category: f.category,
            basisGrams: f.basisGrams,
            calories: f.calories,
            proteinG: f.proteinG,
            carbsG: f.carbsG,
            fatG: f.fatG,
            source: f.source,
            confidence: f.confidence,
          },
          create: {
            id: f.id,
            name: f.name,
            category: f.category,
            basisGrams: f.basisGrams,
            calories: f.calories,
            proteinG: f.proteinG,
            carbsG: f.carbsG,
            fatG: f.fatG,
            source: f.source,
            confidence: f.confidence,
          },
        });
      }
    }

    // Kilo kayıtları
    if (Array.isArray(data.weightLogs)) {
      for (const w of data.weightLogs) {
        await prisma.weightLog.upsert({
          where: { date: w.date },
          update: { weightKg: w.weightKg, conditionsNote: w.conditionsNote },
          create: { date: w.date, weightKg: w.weightKg, conditionsNote: w.conditionsNote },
        });
      }
    }

    // İyilik hali kayıtları
    if (Array.isArray(data.wellbeings)) {
      for (const wb of data.wellbeings) {
        await prisma.dailyWellbeing.upsert({
          where: { date: wb.date },
          update: {
            energy1to5: wb.energy1to5,
            hunger1to5: wb.hunger1to5,
            sleepMinutes: wb.sleepMinutes,
            stress1to5: wb.stress1to5,
            notes: wb.notes,
          },
          create: {
            date: wb.date,
            energy1to5: wb.energy1to5,
            hunger1to5: wb.hunger1to5,
            sleepMinutes: wb.sleepMinutes,
            stress1to5: wb.stress1to5,
            notes: wb.notes,
          },
        });
      }
    }

    return NextResponse.json({ success: true, message: "Yedek başarıyla yüklendi" });
  } catch (error: any) {
    console.error("Backup import error:", error);
    return NextResponse.json(
      { error: error.message || "Yedek geri yüklenemedi" },
      { status: 400 }
    );
  }
}
