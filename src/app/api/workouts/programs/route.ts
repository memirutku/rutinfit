import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/api-error";
import { findProgram, PROGRAMS } from "@/lib/programs";

/** F18: hazır programların özeti. */
export async function GET() {
  return NextResponse.json(
    PROGRAMS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      place: p.place,
      daysPerWeek: p.daysPerWeek,
      days: p.templates.map((t) => ({ dayOfWeek: t.dayOfWeek, name: t.name, exercises: t.exercises.length })),
    }))
  );
}

const ApplySchema = z.object({ programId: z.string().min(1), mode: z.enum(["replace", "add"]) });

/** F18: programı haftalık plana uygular. "replace" mevcut şablonları siler (geçmiş seanslar kalır). */
export async function POST(req: Request) {
  try {
    const { programId, mode } = ApplySchema.parse(await req.json());
    const program = findProgram(programId);
    if (!program) throw new HttpError("Program bulunamadı.", 404);
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
            exercises: { create: t.exercises.map((e, i) => ({ ...e, incrementKg: e.incrementKg ?? 2.5, orderIndex: i })) },
          },
        });
      }
    });
    return NextResponse.json({ created: program.templates.length }, { status: 201 });
  } catch (error) {
    return apiError(error, "Program uygulanamadı", "Programs POST");
  }
}
