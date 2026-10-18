import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import {
  getOpenGymLocalState,
  mapOpenGymWorkoutToRutinFit,
} from "@/lib/opengym-client";

const OPENGYM_DATA_DIR = path.join(process.cwd(), "opengym", "data");

export async function POST() {
  try {
    const localState = getOpenGymLocalState();
    let importedWorkouts = 0;
    let syncedWeights = 0;

    // 1. openGym'den RutinFit'e antrenmanları aktar
    if (localState?.workouts && Array.isArray(localState.workouts)) {
      for (const ogWorkout of localState.workouts) {
        // RutinFit'te bu tarihte ve isimde seans var mı kontrol et
        const existing = await prisma.workoutSession.findFirst({
          where: {
            date: ogWorkout.date,
            name: ogWorkout.name || "openGym Antrenmanı",
          },
        });

        if (!existing) {
          const mapped = mapOpenGymWorkoutToRutinFit(ogWorkout);
          await prisma.workoutSession.create({
            data: {
              date: mapped.date,
              name: mapped.name,
              durationMinutes: mapped.durationMinutes,
              rpe: mapped.rpe,
              notes: mapped.notes,
              completed: true,
              setLogs: {
                create: mapped.setLogs,
              },
            },
          });
          importedWorkouts++;
        }
      }
    }

    // 2. RutinFit'teki tartı verilerini openGym state dosyasına eşitle
    const rfWeights = await prisma.weightLog.findMany({
      orderBy: { date: "asc" },
    });

    if (fs.existsSync(OPENGYM_DATA_DIR) && rfWeights.length > 0) {
      const files = fs.readdirSync(OPENGYM_DATA_DIR);
      const stateFile = files.find(
        (f) => f.startsWith("state-") && f.endsWith(".json")
      );

      if (stateFile) {
        const filePath = path.join(OPENGYM_DATA_DIR, stateFile);
        const currentState = JSON.parse(
          fs.readFileSync(filePath, "utf-8")
        );

        const currentWeights: { date: string; weight: number }[] =
          currentState.bodyWeight || [];
        const dateSet = new Set(currentWeights.map((w) => w.date));

        let addedCount = 0;
        for (const w of rfWeights) {
          if (!dateSet.has(w.date)) {
            currentWeights.push({ date: w.date, weight: w.weightKg });
            addedCount++;
          }
        }

        if (addedCount > 0) {
          currentWeights.sort((a, b) => a.date.localeCompare(b.date));
          currentState.bodyWeight = currentWeights;
          fs.writeFileSync(filePath, JSON.stringify(currentState, null, 2));
          syncedWeights = addedCount;
        }
      }
    }

    return NextResponse.json({
      success: true,
      importedWorkouts,
      syncedWeights,
      message: `Senkronizasyon tamamlandı: ${importedWorkouts} antrenman aktarıldı, ${syncedWeights} tartı kaydı eşitlendi.`,
    });
  } catch (error: any) {
    console.error("openGym sync hatası:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
