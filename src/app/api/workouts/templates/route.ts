import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/api-error";
import { TemplateInputSchema } from "@/lib/schemas/workout";

const withExercises = { exercises: { orderBy: { orderIndex: "asc" as const } } };

const exerciseRows = (exercises: ReturnType<typeof TemplateInputSchema.parse>["exercises"]) =>
  exercises.map((e, i) => ({ ...e, orderIndex: i }));

/** F17: yeni şablon. Egzersizler gönderilen sırayla kaydedilir. */
export async function POST(req: Request) {
  try {
    const { exercises, ...data } = TemplateInputSchema.parse(await req.json());
    const created = await prisma.workoutTemplate.create({
      data: { ...data, notes: data.notes || null, exercises: { create: exerciseRows(exercises) } },
      include: withExercises,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error, "Şablon oluşturulamadı", "Templates POST");
  }
}

/** F17: şablonu tamamen günceller (egzersiz listesi gönderilenle değiştirilir). */
export async function PUT(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const { exercises, ...data } = TemplateInputSchema.parse(await req.json());
    if (!(await prisma.workoutTemplate.findUnique({ where: { id }, select: { id: true } }))) {
      throw new HttpError("Şablon bulunamadı.", 404);
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.workoutExercise.deleteMany({ where: { templateId: id } });
      return tx.workoutTemplate.update({
        where: { id },
        data: { ...data, notes: data.notes || null, exercises: { create: exerciseRows(exercises) } },
        include: withExercises,
      });
    });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, "Şablon güncellenemedi", "Templates PUT");
  }
}

/** F17: şablonu siler; geçmiş seanslar kalır (şablon bağı boşalır). */
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const res = await prisma.workoutTemplate.deleteMany({ where: { id } });
    if (res.count === 0) throw new HttpError("Şablon bulunamadı.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Şablon silinemedi", "Templates DELETE");
  }
}
