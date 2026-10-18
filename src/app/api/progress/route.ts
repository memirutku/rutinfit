import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ProgressLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().positive().optional(),
  waistCm: z.number().positive().optional(),
  energy1to5: z.number().int().min(1).max(5).optional(),
  hunger1to5: z.number().int().min(1).max(5).optional(),
  sleepMinutes: z.number().int().nonnegative().optional(),
  stress1to5: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  creatineTaken: z.boolean().optional(),
  creatineDoseGrams: z.number().positive().default(5.0),
});

export async function GET() {
  try {
    const weights = await prisma.weightLog.findMany({
      orderBy: { date: "asc" },
      take: 60,
    });

    const wellbeings = await prisma.dailyWellbeing.findMany({
      orderBy: { date: "asc" },
      take: 60,
    });

    const supplements = await prisma.supplementLog.findMany({
      where: { name: "Kreatin Monohidrat" },
      orderBy: { date: "asc" },
      take: 60,
    });

    const measurements = await prisma.bodyMeasurement.findMany({
      orderBy: { date: "asc" },
      take: 20,
    });

    // 7 günlük hareketli kilo ortalaması hesaplama
    const weightTrend = weights.map((w, idx) => {
      const windowStart = Math.max(0, idx - 6);
      const windowItems = weights.slice(windowStart, idx + 1);
      const sum = windowItems.reduce((acc, curr) => acc + curr.weightKg, 0);
      const rollingAvg = Math.round((sum / windowItems.length) * 10) / 10;
      return {
        date: w.date,
        weightKg: w.weightKg,
        rollingAvg,
      };
    });

    // Haftalık kilo farkı (en son 7 günlük ortalama ile bir önceki 7 günün farkı)
    let weeklyWeightDelta = 0;
    if (weights.length >= 7) {
      const last7 = weights.slice(-7);
      const prev7 = weights.slice(-14, -7);
      const avgLast7 =
        last7.reduce((a, b) => a + b.weightKg, 0) / last7.length;
      if (prev7.length > 0) {
        const avgPrev7 =
          prev7.reduce((a, b) => a + b.weightKg, 0) / prev7.length;
        weeklyWeightDelta = Math.round((avgLast7 - avgPrev7) * 10) / 10;
      }
    }

    // Kreatin son 7 günlük uyum
    const last7Dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });

    const creatineCompliance = last7Dates.map((date) => {
      const log = supplements.find((s) => s.date === date);
      return {
        date,
        taken: log ? log.taken : false,
      };
    });

    const todayStr = new Date().toISOString().split("T")[0];
    const todayCreatine = supplements.find((s) => s.date === todayStr);
    const todayWellbeing = wellbeings.find((w) => w.date === todayStr);
    const todayWeight = weights.find((w) => w.date === todayStr);

    return NextResponse.json({
      weights: weightTrend,
      wellbeings,
      measurements,
      creatineCompliance,
      weeklyWeightDelta,
      today: {
        date: todayStr,
        creatineTaken: todayCreatine?.taken ?? false,
        weightKg: todayWeight?.weightKg ?? null,
        energy1to5: todayWellbeing?.energy1to5 ?? null,
        sleepMinutes: todayWellbeing?.sleepMinutes ?? null,
        hunger1to5: todayWellbeing?.hunger1to5 ?? null,
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
      data.notes !== undefined
    ) {
      await prisma.dailyWellbeing.upsert({
        where: { date: data.date },
        update: {
          energy1to5: data.energy1to5,
          hunger1to5: data.hunger1to5,
          sleepMinutes: data.sleepMinutes,
          stress1to5: data.stress1to5,
          notes: data.notes,
        },
        create: {
          date: data.date,
          energy1to5: data.energy1to5 ?? 3,
          hunger1to5: data.hunger1to5 ?? 3,
          sleepMinutes: data.sleepMinutes ?? 420,
          stress1to5: data.stress1to5 ?? 3,
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
  } catch (error: any) {
    console.error("Progress POST error:", error);
    return NextResponse.json(
      { error: error.message || "İlerleme kaydedilemedi" },
      { status: 400 }
    );
  }
}
