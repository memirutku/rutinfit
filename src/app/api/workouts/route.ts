import { NextResponse } from "next/server";
import { WorkoutSessionInputSchema } from "@/lib/schemas/workout";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { evaluateExerciseProgression } from "@/lib/progression";
import { isWorkingSet } from "@/lib/set-types";
import { detectPlateau, exerciseHistory } from "@/lib/strength";
import { normalizeName } from "@/lib/text";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    const templates = await prisma.workoutTemplate.findMany({
      include: {
        exercises: {
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { dayOfWeek: "asc" },
    });

    const where: any = {};
    if (date) {
      where.date = date;
    }

    const sessions = await prisma.workoutSession.findMany({
      where,
      include: {
        setLogs: {
          orderBy: [{ exerciseName: "asc" }, { setNumber: "asc" }],
        },
        template: true,
      },
      orderBy: { date: "desc" },
      take: 20,
    });

    return NextResponse.json({ templates, sessions });
  } catch (error) {
    console.error("Workouts GET error:", error);
    return NextResponse.json(
      { error: "Antrenman verileri getirilemedi" },
      { status: 500 }
    );
  }
}

/** F21: egzersizin tamamlanmış seans geçmişinde durağanlık (çalışma setleri). */
async function plateauFor(exerciseName: string) {
  const key = normalizeName(exerciseName);
  const rows = await prisma.setLog.findMany({
    where: { session: { completed: true }, setType: { not: "warmup" } },
    select: { exerciseName: true, weightKg: true, reps: true, session: { select: { date: true } } },
  });
  const sets = rows
    .filter((r) => normalizeName(r.exerciseName) === key)
    .map((r) => ({ date: r.session.date, weightKg: r.weightKg, reps: r.reps }));
  return detectPlateau(exerciseHistory(sets));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = WorkoutSessionInputSchema.parse(body);

    const session = await prisma.workoutSession.create({
      data: {
        date: validated.date,
        templateId: validated.templateId || null,
        name: validated.name,
        durationMinutes: validated.durationMinutes,
        rpe: validated.rpe || null,
        notes: validated.notes || null,
        completed: validated.completed,
        setLogs: {
          create: validated.setLogs.map((set) => ({
            exerciseName: set.exerciseName,
            setNumber: set.setNumber,
            weightKg: set.weightKg,
            reps: set.reps,
            rpe: set.rpe ?? null,
            setType: set.setType,
            // F19: ısınma seti hedef sayılmaz.
            isTargetMet: isWorkingSet(set.setType) && set.reps >= set.targetRepMax,
          })),
        },
      },
      include: {
        setLogs: true,
      },
    });

    // Her egzersiz için ilerleme tavsiyelerini hesapla (F19: yalnız çalışma setleri).
    const exerciseGroups: Record<string, typeof validated.setLogs> = {};
    for (const set of validated.setLogs.filter((s) => isWorkingSet(s.setType))) {
      if (!exerciseGroups[set.exerciseName]) {
        exerciseGroups[set.exerciseName] = [];
      }
      exerciseGroups[set.exerciseName].push(set);
    }

    // F21: şablondaki egzersiz başına artış miktarı.
    const templateExercises = validated.templateId
      ? await prisma.workoutExercise.findMany({ where: { templateId: validated.templateId } })
      : [];
    const incrementFor = (name: string) =>
      templateExercises.find((e) => normalizeName(e.exerciseName) === normalizeName(name))?.incrementKg ?? 2.5;

    const progressionFeedbacks: Record<string, any> = {};
    for (const [exName, sets] of Object.entries(exerciseGroups)) {
      progressionFeedbacks[exName] = {
        ...evaluateExerciseProgression(
          sets.map((s) => ({
            setNumber: s.setNumber,
            weightKg: s.weightKg,
            reps: s.reps,
            targetRepMin: s.targetRepMin,
            targetRepMax: s.targetRepMax,
          })),
          incrementFor(exName)
        ),
        plateau: await plateauFor(exName),
      };
    }

    return NextResponse.json(
      {
        session,
        progressionFeedbacks,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, "Antrenman kaydedilemedi", "Workouts POST");
  }
}
