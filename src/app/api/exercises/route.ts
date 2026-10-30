import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/api-error";
import { alternativesFor, EQUIPMENT_KEYS, findExercise, searchExercises } from "@/lib/exercise-library";
import { MUSCLE_GROUPS } from "@/lib/muscles";
import { loadExerciseLibrary } from "@/lib/services/exercises";
import { normalizeName } from "@/lib/text";

const MUSCLE_IDS = MUSCLE_GROUPS.map((m) => m.muscleId) as [string, ...string[]];

const CustomExerciseSchema = z.object({
  name: z.string().trim().min(2, "Ad en az 2 karakter olmalı.").max(60),
  nameTr: z.string().trim().max(60).optional(),
  primary: z.enum(MUSCLE_IDS),
  secondary: z.array(z.enum(MUSCLE_IDS)).max(6).default([]),
  equipment: z.enum(EQUIPMENT_KEYS),
  cues: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
});

/**
 * F25: GET ?search=&muscle=&equipment= — kütüphane (özel egzersizler dahil).
 * GET ?alternativesFor=Ad — o egzersiz ve aynı ana kası çalıştıran benzerleri.
 */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const library = await loadExerciseLibrary();
    const target = params.get("alternativesFor");
    if (target) {
      const exercise = findExercise(target, library);
      if (!exercise) throw new HttpError("Egzersiz kütüphanede bulunamadı.", 404);
      return NextResponse.json({ exercise, alternatives: alternativesFor(exercise, library) });
    }
    return NextResponse.json(
      searchExercises(library, {
        search: params.get("search") ?? undefined,
        muscle: params.get("muscle") ?? undefined,
        equipment: params.get("equipment") ?? undefined,
      })
    );
  } catch (error) {
    return apiError(error, "Egzersizler getirilemedi", "Exercises GET");
  }
}

export async function POST(req: Request) {
  try {
    const input = CustomExerciseSchema.parse(await req.json());
    const library = await loadExerciseLibrary();
    const key = normalizeName(input.name);
    if (library.some((e) => normalizeName(e.name) === key || normalizeName(e.nameTr) === key)) {
      throw new HttpError("Bu adla bir egzersiz zaten var.", 409);
    }
    const created = await prisma.customExercise.create({
      data: {
        name: input.name,
        nameTr: input.nameTr || null,
        primary: input.primary,
        secondary: JSON.stringify(input.secondary),
        equipment: input.equipment,
        cues: JSON.stringify(input.cues),
      },
    });
    return NextResponse.json(
      { id: created.id, name: created.name, nameTr: created.nameTr || created.name, primary: input.primary, secondary: input.secondary, equipment: input.equipment, cues: input.cues, isCustom: true },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, "Egzersiz eklenemedi", "Exercises POST");
  }
}

/** Yalnız özel egzersizler silinebilir. */
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const res = await prisma.customExercise.deleteMany({ where: { id } });
    if (res.count === 0) throw new HttpError("Özel egzersiz bulunamadı.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Egzersiz silinemedi", "Exercises DELETE");
  }
}
