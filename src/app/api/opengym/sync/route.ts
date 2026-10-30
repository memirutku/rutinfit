import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import {
  getOpenGymLocalState,
  mapOpenGymWorkoutToRutinFit,
  syncWeightsToOpenGymState,
} from "@/lib/opengym-client";

export async function POST() {
  try {
    const localState = await getOpenGymLocalState();
    let importedWorkouts = 0;

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

    const syncedWeights = await syncWeightsToOpenGymState(rfWeights);

    return NextResponse.json({
      success: true,
      importedWorkouts,
      syncedWeights,
      message: `Senkronizasyon tamamlandı: ${importedWorkouts} antrenman aktarıldı, ${syncedWeights} tartı kaydı eşitlendi.`,
    });
  } catch (error) {
    return apiError(error, "openGym senkronizasyonu başarısız oldu.", "openGym sync");
  }
}
