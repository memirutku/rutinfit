import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/api-error";
import { CARDIO_KIND_KEYS, estimateCardioKcal, formatPace, summarizeCardio } from "@/lib/cardio";
import { addDaysToDateString, getLocalDateString } from "@/lib/date-utils";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const CardioInputSchema = z.object({
  date: date.optional(),
  kind: z.enum(CARDIO_KIND_KEYS),
  durationMin: z.number().positive("Süre 0'dan büyük olmalı.").max(1440),
  distanceKm: z.number().positive().max(500).nullable().optional(),
  avgHr: z.number().int().min(30).max(230).nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  kcal: z.number().nonnegative().max(10000).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
});

const withPace = <T extends { durationMin: number; distanceKm: number | null }>(log: T) => ({
  ...log,
  pace: formatPace(log.durationMin, log.distanceKm),
});

/** F27: GET ?from=&to= (varsayılan son 30 gün) — kayıtlar (yeniden eskiye) ve aralık özeti. */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const to = params.get("to") ?? getLocalDateString();
    const from = params.get("from") ?? addDaysToDateString(to, -29);
    const logs = await prisma.cardioLog.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ from, to, logs: logs.map(withPace), summary: summarizeCardio(logs) });
  } catch (error) {
    return apiError(error, "Kardiyo kayıtları getirilemedi", "Cardio GET");
  }
}

export async function POST(req: Request) {
  try {
    const input = CardioInputSchema.parse(await req.json());
    const distanceKm = input.distanceKm ?? null;
    let kcal = input.kcal ?? null;
    let kcalEstimated = false;
    if (kcal === null) {
      const profile = await prisma.userProfile.findFirst({ select: { currentWeightKg: true } });
      kcal = estimateCardioKcal({ kind: input.kind, durationMin: input.durationMin, distanceKm }, profile?.currentWeightKg ?? 70);
      kcalEstimated = true;
    }
    const created = await prisma.cardioLog.create({
      data: {
        date: input.date ?? getLocalDateString(),
        kind: input.kind,
        durationMin: input.durationMin,
        distanceKm,
        avgHr: input.avgHr ?? null,
        rpe: input.rpe ?? null,
        kcal,
        kcalEstimated,
        notes: input.notes || null,
      },
    });
    return NextResponse.json(withPace(created), { status: 201 });
  } catch (error) {
    return apiError(error, "Kardiyo kaydedilemedi", "Cardio POST");
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const res = await prisma.cardioLog.deleteMany({ where: { id } });
    if (res.count === 0) throw new HttpError("Kayıt bulunamadı.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Kardiyo kaydı silinemedi", "Cardio DELETE");
  }
}
