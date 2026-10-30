import { NextResponse } from "next/server";
import { ProgressLogSchema } from "@/lib/schemas/progress";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { addDaysToDateString, getLocalDateString } from "@/lib/date-utils";
import { computeWeeklyDelta, computeWeightTrend, lastNDates } from "@/lib/services/progress";

const CHART_DAYS = 60;
const CREATINE = "Kreatin Monohidrat";

/** Liste en yeni N kaydı (desc + take) alıp grafik için eskiden yeniye çevirir. */
const newestFirst = { orderBy: { date: "desc" as const }, take: CHART_DAYS };

export async function GET() {
  try {
    const todayStr = getLocalDateString();
    const weekAgo14 = addDaysToDateString(todayStr, -13);

    const [weightsDesc, wellbeingsDesc, measurementsDesc, recentCreatine, deltaWeights, todayCreatine, todayWellbeing, todayWeight, creatineSupplement] =
      await Promise.all([
        prisma.weightLog.findMany(newestFirst),
        prisma.dailyWellbeing.findMany(newestFirst),
        prisma.bodyMeasurement.findMany({ orderBy: { date: "desc" }, take: 20 }),
        prisma.supplementLog.findMany({
          where: { name: CREATINE, date: { gte: addDaysToDateString(todayStr, -6), lte: todayStr } },
        }),
        prisma.weightLog.findMany({ where: { date: { gte: weekAgo14, lte: todayStr } } }),
        prisma.supplementLog.findUnique({ where: { date_name: { date: todayStr, name: CREATINE } } }),
        prisma.dailyWellbeing.findUnique({ where: { date: todayStr } }),
        prisma.weightLog.findUnique({ where: { date: todayStr } }),
        prisma.supplement.findFirst({ where: { name: CREATINE, active: true }, select: { id: true } }),
      ]);

    const weights = weightsDesc.reverse();
    const creatineByDate = new Map(recentCreatine.map((s) => [s.date, s.taken]));

    return NextResponse.json({
      weights: computeWeightTrend(weights),
      wellbeings: wellbeingsDesc.reverse(),
      measurements: measurementsDesc.reverse(),
      creatineCompliance: lastNDates(todayStr, 7).map((date) => ({ date, taken: creatineByDate.get(date) ?? false })),
      // B02: kreatin kartı yalnız kreatin kullanan kullanıcıya görünür.
      creatineTracked: !!creatineSupplement || recentCreatine.some((s) => s.taken),
      weeklyWeightDelta: computeWeeklyDelta(deltaWeights, todayStr),
      today: {
        date: todayStr,
        creatineTaken: todayCreatine?.taken ?? false,
        weightKg: todayWeight?.weightKg ?? null,
        energy1to5: todayWellbeing?.energy1to5 ?? null,
        sleepMinutes: todayWellbeing?.sleepMinutes ?? null,
        hunger1to5: todayWellbeing?.hunger1to5 ?? null,
        stress1to5: todayWellbeing?.stress1to5 ?? null,
        soreness1to5: todayWellbeing?.soreness1to5 ?? null,
        mood1to5: todayWellbeing?.mood1to5 ?? null,
        cycleNote: todayWellbeing?.cycleNote ?? null,
      },
    });
  } catch (error) {
    console.error("Progress GET error:", error);
    return NextResponse.json(
      { error: "İlerleme verileri getirilemedi" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = ProgressLogSchema.parse(body);

    // Kilo kaydı
    if (data.weightKg !== undefined) {
      await prisma.weightLog.upsert({
        where: { date: data.date },
        update: { weightKg: data.weightKg },
        create: { date: data.date, weightKg: data.weightKg },
      });
    }

    // Bel ölçümü
    if (data.waistCm !== undefined) {
      await prisma.bodyMeasurement.upsert({
        where: { date: data.date },
        update: { waistCm: data.waistCm },
        create: { date: data.date, waistCm: data.waistCm },
      });
    }

    // İyilik hali (enerji, uyku, açlık, stres)
    if (
      data.energy1to5 !== undefined ||
      data.hunger1to5 !== undefined ||
      data.sleepMinutes !== undefined ||
      data.stress1to5 !== undefined ||
      data.soreness1to5 !== undefined ||
      data.mood1to5 !== undefined ||
      data.cycleNote !== undefined ||
      data.notes !== undefined
    ) {
      await prisma.dailyWellbeing.upsert({
        where: { date: data.date },
        update: {
          energy1to5: data.energy1to5,
          hunger1to5: data.hunger1to5,
          sleepMinutes: data.sleepMinutes,
          stress1to5: data.stress1to5,
          soreness1to5: data.soreness1to5,
          mood1to5: data.mood1to5,
          cycleNote: data.cycleNote,
          notes: data.notes,
        },
        create: {
          date: data.date,
          // B04: gönderilmeyen alan boş kalır.
          energy1to5: data.energy1to5 ?? null,
          hunger1to5: data.hunger1to5 ?? null,
          sleepMinutes: data.sleepMinutes ?? null,
          stress1to5: data.stress1to5 ?? null,
          soreness1to5: data.soreness1to5 ?? null,
          mood1to5: data.mood1to5 ?? null,
          cycleNote: data.cycleNote ?? null,
          notes: data.notes ?? null,
        },
      });
    }

    // Kreatin kaydı
    if (data.creatineTaken !== undefined) {
      await prisma.supplementLog.upsert({
        where: {
          date_name: {
            date: data.date,
            name: "Kreatin Monohidrat",
          },
        },
        update: {
          taken: data.creatineTaken,
          doseGrams: data.creatineDoseGrams,
        },
        create: {
          date: data.date,
          name: "Kreatin Monohidrat",
          doseGrams: data.creatineDoseGrams,
          taken: data.creatineTaken,
        },
      });
    }

    return NextResponse.json({ success: true, date: data.date });
  } catch (error) {
    return apiError(error, "İlerleme kaydedilemedi", "Progress POST");
  }
}
