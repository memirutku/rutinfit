import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWorkoutCsv } from "@/lib/workout-importer";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let csvText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
      }
      csvText = await file.text();
    } else {
      const body = await req.json().catch(() => ({}));
      csvText = typeof body?.csvText === "string" ? body.csvText : "";
    }

    if (!csvText) {
      return NextResponse.json(
        { error: "Ayrıştırılacak CSV içeriği boş" },
        { status: 400 }
      );
    }

    const parseResult = parseWorkoutCsv(csvText);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "CSV ayrıştırılamadı",
          details: parseResult.errors,
        },
        { status: 422 }
      );
    }

    // Tek transaction: yarıda kalırsa hiçbir antrenman yazılmaz.
    // Aynı tarih + ad ile zaten kayıtlı seans (önceki içe aktarma) atlanır.
    const { savedWorkoutsCount, savedSetsCount, skippedDuplicates } = await prisma.$transaction(
      async (tx) => {
        let saved = 0;
        let sets = 0;
        let skipped = 0;
        for (const workout of parseResult.workouts) {
          const existing = await tx.workoutSession.findFirst({
            where: { date: workout.date, name: workout.name },
            select: { id: true },
          });
          if (existing) {
            skipped++;
            continue;
          }
          await tx.workoutSession.create({
            data: {
              date: workout.date,
              name: workout.name,
              durationMinutes: workout.durationMinutes || 45,
              completed: true,
              notes: workout.notes || "CSV aktarımı",
              setLogs: {
                create: workout.sets.map((s, idx) => ({
                  exerciseName: s.exerciseName,
                  setNumber: s.setNumber || idx + 1,
                  weightKg: s.weightKg,
                  reps: s.reps,
                  isTargetMet: s.reps >= 8,
                })),
              },
            },
          });
          saved++;
          sets += workout.sets.length;
        }
        return { savedWorkoutsCount: saved, savedSetsCount: sets, skippedDuplicates: skipped };
      },
      { timeout: 30_000 }
    );

    return NextResponse.json({
      success: true,
      message:
        `${savedWorkoutsCount} antrenman ve ${savedSetsCount} set başarıyla RutinFit'e kaydedildi.` +
        (skippedDuplicates > 0 ? ` ${skippedDuplicates} antrenman zaten kayıtlı olduğu için atlandı.` : ""),
      appType: parseResult.appType,
      savedWorkoutsCount,
      savedSetsCount,
      skippedDuplicates,
    });
  } catch (error: any) {
    console.error("Workout import error:", error);
    return NextResponse.json(
      { error: "Antrenman aktarılırken bir hata oluştu" },
      { status: 500 }
    );
  }
}
