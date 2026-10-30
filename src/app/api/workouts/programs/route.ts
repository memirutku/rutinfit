import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/api-error";
import { findProgram, PROGRAMS, trainingMaxFrom1Rm } from "@/lib/programs";
import { ApplyProgramSchema } from "@/lib/schemas/workout";
import { estimate1Rm } from "@/lib/strength";
import { normalizeName } from "@/lib/text";

/** F18: hazır programların özeti. B21: seviye ve 1RM'i sorulan kaldırışlar. */
export async function GET() {
  return NextResponse.json(
    PROGRAMS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      place: p.place,
      daysPerWeek: p.daysPerWeek,
      level: p.level,
      oneRepMaxLifts: p.oneRepMaxLifts ?? [],
      days: p.templates.map((t) => ({ dayOfWeek: t.dayOfWeek, name: t.name, exercises: t.exercises.length })),
    }))
  );
}

/** B21: tamamlanmış çalışma setlerinden egzersiz başına en iyi e1RM (ad eşleşmesi esnek). */
async function bestE1rmByExercise(names: string[]): Promise<Map<string, number>> {
  const wanted = new Map(names.map((n) => [normalizeName(n), n]));
  const best = new Map<string, number>();
  if (wanted.size === 0) return best;
  const rows = await prisma.setLog.findMany({
    where: { session: { completed: true }, setType: { not: "warmup" } },
    select: { exerciseName: true, weightKg: true, reps: true },
  });
  for (const r of rows) {
    const name = wanted.get(normalizeName(r.exerciseName));
    if (!name) continue;
    const e1rm = estimate1Rm(r.weightKg, r.reps);
    if (e1rm > (best.get(name) ?? 0)) best.set(name, e1rm);
  }
  return best;
}

/**
 * F18: programı haftalık plana uygular. "replace" mevcut şablonları siler (geçmiş seanslar kalır).
 * B21: %1RM'e bağlı kaldırışlarda antrenman maksimumu girilen 1RM'den, girilmediyse e1RM
 * geçmişinden %90 olarak hesaplanır; ikisi de yoksa boş kalır (seansta ağırlık elle girilir).
 */
export async function POST(req: Request) {
  try {
    const { programId, mode, oneRepMaxes = {} } = ApplyProgramSchema.parse(await req.json());
    const program = findProgram(programId);
    if (!program) throw new HttpError("Program bulunamadı.", 404);

    const lifts = program.oneRepMaxLifts ?? [];
    const history = await bestE1rmByExercise(lifts.filter((l) => !(oneRepMaxes[l] > 0)));
    const trainingMax = (name: string) => trainingMaxFrom1Rm(oneRepMaxes[name] > 0 ? oneRepMaxes[name] : (history.get(name) ?? 0));

    await prisma.$transaction(async (tx) => {
      if (mode === "replace") await tx.workoutTemplate.deleteMany({});
      for (const t of program.templates) {
        await tx.workoutTemplate.create({
          data: {
            name: t.name,
            type: t.type,
            dayOfWeek: t.dayOfWeek,
            targetDurationMinutes: t.targetDurationMinutes,
            notes: t.notes ?? null,
            exercises: {
              create: t.exercises.map((e, i) => ({
                ...e,
                incrementKg: e.incrementKg ?? 2.5,
                loadingScheme: e.loadingScheme ?? null,
                trainingMaxKg: e.loadingScheme ? trainingMax(e.exerciseName) : null,
                orderIndex: i,
              })),
            },
          },
        });
      }
    });
    return NextResponse.json({ created: program.templates.length }, { status: 201 });
  } catch (error) {
    return apiError(error, "Program uygulanamadı", "Programs POST");
  }
}
