import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/api-error";
import { builtinMeasuresFor, MEASURE_NAMES, mergeMeasures } from "@/lib/measures";

const MeasureInputSchema = z.object({
  foodItemId: z.string().min(1),
  name: z.enum(MEASURE_NAMES),
  grams: z.number().positive("Gram 0'dan büyük olmalı.").max(2000),
});

/** F73: GET ?foodId= — besinin ev ölçüleri (yerleşik + kullanıcının). */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    // Hızlı ekleme için bütün kullanıcı ölçüleri (az sayıda).
    if (params.get("all")) return NextResponse.json({ custom: await prisma.foodMeasure.findMany() });
    const foodId = params.get("foodId") || "";
    const food = await prisma.foodItem.findUnique({ where: { id: foodId }, include: { measures: true } });
    if (!food) throw new HttpError("Besin bulunamadı.", 404);
    return NextResponse.json({ food: { id: food.id, name: food.name }, measures: mergeMeasures(builtinMeasuresFor(food.name), food.measures) });
  } catch (error) {
    return apiError(error, "Ölçüler getirilemedi", "Measures GET");
  }
}

/** Kullanıcının tartımı: aynı adlı ölçü varsa güncellenir. */
export async function POST(req: Request) {
  try {
    const input = MeasureInputSchema.parse(await req.json());
    const saved = await prisma.foodMeasure.upsert({
      where: { foodItemId_name: { foodItemId: input.foodItemId, name: input.name } },
      update: { grams: input.grams },
      create: input,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return apiError(error, "Ölçü kaydedilemedi", "Measures POST");
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const res = await prisma.foodMeasure.deleteMany({ where: { id } });
    if (res.count === 0) throw new HttpError("Ölçü bulunamadı.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Ölçü silinemedi", "Measures DELETE");
  }
}
