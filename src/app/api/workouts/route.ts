import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { z } from "zod";
import { evaluateExerciseProgression } from "@/lib/progression";

const SetLogSchema = z.object({
  exerciseName: z.string().min(1),
  setNumber: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  targetRepMin: z.number().int().positive().default(8),
  targetRepMax: z.number().int().positive().default(12),
  isTargetMet: z.boolean().default(false),
});

const WorkoutSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  templateId: z.string().optional().nullable(),
  name: z.string().min(1),
  durationMinutes: z.number().int().nonnegative(),
  rpe: z.number().int().min(1).max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  completed: z.boolean().default(true),
  setLogs: z.array(SetLogSchema).optional().default([]),
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = WorkoutSessionSchema.parse(body);

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
            isTargetMet: set.reps >= set.targetRepMax,
          })),
        },
      },
      include: {
        setLogs: true,
      },
    });

    // Her egzersiz için ilerleme tavsiyelerini hesapla
    const exerciseGroups: Record<string, typeof validated.setLogs> = {};
    for (const set of validated.setLogs) {
      if (!exerciseGroups[set.exerciseName]) {
        exerciseGroups[set.exerciseName] = [];
      }
      exerciseGroups[set.exerciseName].push(set);
    }

    const progressionFeedbacks: Record<string, any> = {};
    for (const [exName, sets] of Object.entries(exerciseGroups)) {
      progressionFeedbacks[exName] = evaluateExerciseProgression(
        sets.map((s) => ({
          setNumber: s.setNumber,
          weightKg: s.weightKg,
          reps: s.reps,
          targetRepMin: s.targetRepMin,
          targetRepMax: s.targetRepMax,
        }))
      );
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
