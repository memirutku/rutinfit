import { NextResponse } from "next/server";
import { WorkoutSessionInputSchema } from "@/lib/schemas/workout";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/api-error";
import { evaluateExerciseProgression } from "@/lib/progression";
import { isWorkingSet } from "@/lib/set-types";
import { detectPlateau, exerciseHistory } from "@/lib/strength";
import { normalizeName } from "@/lib/text";

const DEFAULT_SESSIONS = 20;
const MAX_SESSIONS = 200;

/** B17: tamamlanmamış setler atılır; hiç tamamlanmış set yoksa seans yazılmaz. */
function completedSetsOnly<T extends { setLogs: Array<{ completed?: boolean }> }>(input: T): T {
  const setLogs = input.setLogs.filter((s) => s.completed !== false);
  if (setLogs.length === 0) {
    throw new HttpError("Kaydedilecek tamamlanmış set yok. En az bir seti 'Tamamla' ile işaretleyin.", 400);
  }
  return { ...input, setLogs };
}

type ValidatedSet = ReturnType<typeof WorkoutSessionInputSchema.parse>["setLogs"][number];

/** Kaydedilecek set satırı. F19: ısınma seti hedef sayılmaz. */
const setRow = (set: ValidatedSet) => ({
  exerciseName: set.exerciseName,
  setNumber: set.setNumber,
  weightKg: set.weightKg,
  reps: set.reps,
  rpe: set.rpe ?? null,
  setType: set.setType,
  isTargetMet: isWorkingSet(set.setType) && set.reps >= set.targetRepMax,
});

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
    // B19: seans geçmişi daha fazla seans isteyebilir (varsayılan 20, en çok 200).
    const limitParam = Number(searchParams.get("limit"));
    const take = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_SESSIONS) : DEFAULT_SESSIONS;

    const sessions = await prisma.workoutSession.findMany({
      where,
      include: {
        setLogs: {
          orderBy: [{ exerciseName: "asc" }, { setNumber: "asc" }],
        },
        template: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take,
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
    // B17: tamamlanmamış setler kaydedilmez; hiç tamamlanmış set yoksa seans da yazılmaz.
    const validated = completedSetsOnly(WorkoutSessionInputSchema.parse(body));

    const session = await prisma.workoutSession.create({
      data: {
        date: validated.date,
        templateId: validated.templateId || null,
        name: validated.name,
        durationMinutes: validated.durationMinutes,
        rpe: validated.rpe || null,
        notes: validated.notes || null,
        completed: validated.completed,
        setLogs: { create: validated.setLogs.map(setRow) },
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

/** B19: geçmiş seansı düzenler (tarih, ad, süre, not ve setler; setler gönderilenle değiştirilir). */
export async function PUT(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const validated = completedSetsOnly(WorkoutSessionInputSchema.parse(await req.json()));
    if (!(await prisma.workoutSession.findUnique({ where: { id }, select: { id: true } }))) {
      throw new HttpError("Seans bulunamadı.", 404);
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.setLog.deleteMany({ where: { workoutSessionId: id } });
      return tx.workoutSession.update({
        where: { id },
        data: {
          date: validated.date,
          name: validated.name,
          durationMinutes: validated.durationMinutes,
          rpe: validated.rpe || null,
          notes: validated.notes || null,
          setLogs: { create: validated.setLogs.map(setRow) },
        },
        include: { setLogs: { orderBy: [{ exerciseName: "asc" }, { setNumber: "asc" }] } },
      });
    });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, "Seans güncellenemedi", "Workouts PUT");
  }
}

/** B19: seansı ve setlerini siler. */
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const res = await prisma.workoutSession.deleteMany({ where: { id } });
    if (res.count === 0) throw new HttpError("Seans bulunamadı.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Seans silinemedi", "Workouts DELETE");
  }
}
