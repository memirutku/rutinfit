import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWorkoutCsv, type ImportedWorkout } from "@/lib/workout-importer";
import { toSetRpe } from "@/lib/rpe";
import { isWorkingSet } from "@/lib/set-types";

const norm = (v: string) => v.trim().toLocaleLowerCase("tr-TR");

interface TemplateIndex {
  byName: Map<string, { id: string; exercises: Map<string, { repMax: number }> }>;
  anyExercise: Map<string, { repMax: number }>;
}

/** H4: şablonları ad ve egzersiz adına göre dizinler (büyük/küçük harf duyarsız). */
async function loadTemplateIndex(): Promise<TemplateIndex> {
  const templates = await prisma.workoutTemplate.findMany({ include: { exercises: true } });
  const byName: TemplateIndex["byName"] = new Map();
  const anyExercise: TemplateIndex["anyExercise"] = new Map();
  for (const t of templates) {
    const exercises = new Map(t.exercises.map((e) => [norm(e.exerciseName), { repMax: e.repMax }]));
    byName.set(norm(t.name), { id: t.id, exercises });
    for (const [k, v] of exercises) if (!anyExercise.has(k)) anyExercise.set(k, v);
  }
  return { byName, anyExercise };
}

/** H3: seans RPE'si = set RPE'lerinin yuvarlanmış ortalaması (1–10); set RPE'si yoksa null. */
function sessionRpe(workout: ImportedWorkout): number | null {
  const values = workout.sets
    .filter((s) => isWorkingSet(s.setType))
    .map((s) => toSetRpe(s.rpe))
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  return Math.min(10, Math.max(1, Math.round(values.reduce((a, b) => a + b, 0) / values.length)));
}

function summaryMessage(saved: number, sets: number, skipped: number, parse: ReturnType<typeof parseWorkoutCsv>) {
  const parts = [`${saved} antrenman ve ${sets} set başarıyla RutinFit'e kaydedildi.`];
  if (skipped > 0) parts.push(`${skipped} antrenman zaten kayıtlı olduğu için atlandı.`);
  if (parse.ignoredColumns.length) parts.push(`Aktarılmayan sütunlar: ${parse.ignoredColumns.join(", ")}.`);
  parts.push(...parse.warnings);
  return parts.join(" ");
}

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
    const templates = await loadTemplateIndex();
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
          const template = templates.byName.get(norm(workout.name));
          const targetFor = (exerciseName: string) =>
            template?.exercises.get(norm(exerciseName)) ?? templates.anyExercise.get(norm(exerciseName));
          await tx.workoutSession.create({
            data: {
              date: workout.date,
              name: workout.name,
              templateId: template?.id ?? null,
              // Süre dosyada yoksa uydurulmaz: 0 = girilmedi (geçmişte "—").
              durationMinutes: workout.durationMinutes || 0,
              rpe: sessionRpe(workout),
              completed: true,
              notes: workout.notes || "CSV aktarımı",
              setLogs: {
                create: workout.sets.map((s, idx) => {
                  const target = targetFor(s.exerciseName);
                  return {
                    exerciseName: s.exerciseName,
                    setNumber: s.setNumber || idx + 1,
                    weightKg: s.weightKg,
                    reps: s.reps,
                    rpe: toSetRpe(s.rpe),
                    setType: s.setType,
                    // Canlı kayıtla aynı kural: üst tekrar sınırına ulaşan çalışma seti. Şablon yoksa bilinmez.
                    isTargetMet: target && isWorkingSet(s.setType) ? s.reps >= target.repMax : false,
                  };
                }),
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
      message: summaryMessage(savedWorkoutsCount, savedSetsCount, skippedDuplicates, parseResult),
      appType: parseResult.appType,
      warnings: parseResult.warnings,
      ignoredColumns: parseResult.ignoredColumns,
      skippedWarmupSets: parseResult.skippedWarmupSets,
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
