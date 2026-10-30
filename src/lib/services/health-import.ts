/**
 * F62: Apple Sağlık kayıtları. Tarayıcı dışa aktarımı okur ve günlük özetleri partiler hâlinde
 * gönderir; burada anahtara göre eklenir ya da güncellenir (aynı dosyayı tekrar yüklemek kopya
 * oluşturmaz). Kayıtlar salt okunurdur: kilo ve kardiyo kayıtlarına karışmaz.
 */
import { z } from "zod";
import { prisma } from "../prisma";
import { addDaysToDateString, getLocalDateString } from "../date-utils";
import { HEALTH_TYPES, type WorkoutDetail } from "../apple-health";

export const HEALTH_IMPORT_BATCH = 5000;

const HealthRecordSchema = z.object({
  key: z.string().min(1).max(200),
  type: z.enum(HEALTH_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().finite().min(0).max(1_000_000),
  unit: z.string().max(20),
  source: z.string().max(120),
  detail: z
    .object({
      activity: z.string().max(80),
      durationMin: z.number().min(0).max(10_000),
      distanceKm: z.number().min(0).max(10_000).nullable(),
      kcal: z.number().min(0).max(100_000).nullable(),
    })
    .nullable()
    .optional(),
});

export const HealthImportSchema = z.object({ records: z.array(HealthRecordSchema).max(HEALTH_IMPORT_BATCH) });

export async function importHealthRecords(records: z.infer<typeof HealthRecordSchema>[]) {
  if (!records.length) return { created: 0, updated: 0 };
  const existing = new Set(
    (await prisma.healthRecord.findMany({ where: { key: { in: records.map((r) => r.key) } }, select: { key: true } })).map((r) => r.key)
  );
  await prisma.$transaction(
    records.map((r) => {
      const data = { type: r.type, date: r.date, value: r.value, unit: r.unit, source: r.source, detail: r.detail ? JSON.stringify(r.detail) : null };
      return prisma.healthRecord.upsert({ where: { key: r.key }, update: data, create: { key: r.key, ...data } });
    })
  );
  const updated = records.filter((r) => existing.has(r.key)).length;
  return { created: records.length - updated, updated };
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export async function healthSummary(today = getLocalDateString()) {
  const from30 = addDaysToDateString(today, -29);
  const from7 = addDaysToDateString(today, -6);
  const [total, last, steps, kcal, hr, weight, ownWeight, workouts] = await Promise.all([
    prisma.healthRecord.count(),
    prisma.healthRecord.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.healthRecord.findMany({ where: { type: "steps", date: { gte: from30, lte: today } }, orderBy: { date: "asc" } }),
    prisma.healthRecord.findMany({ where: { type: "active_kcal", date: { gte: from7, lte: today } } }),
    prisma.healthRecord.findMany({ where: { type: "resting_hr", date: { gte: from30, lte: today } }, orderBy: { date: "asc" } }),
    prisma.healthRecord.findFirst({ where: { type: "weight_kg" }, orderBy: { date: "desc" } }),
    prisma.weightLog.findFirst({ orderBy: { date: "desc" } }),
    prisma.healthRecord.findMany({ where: { type: "workout" }, orderBy: { date: "desc" }, take: 10 }),
  ]);
  const lastHr = hr[hr.length - 1];
  return {
    total,
    lastImportedAt: last?.updatedAt.toISOString() ?? null,
    steps: {
      avg7: avg(steps.filter((s) => s.date >= from7).map((s) => s.value)),
      avg30: avg(steps.map((s) => s.value)),
      series: steps.map((s) => ({ date: s.date, value: s.value })),
    },
    activeKcal: { avg7: avg(kcal.map((k) => k.value)) },
    restingHr: { latest: lastHr ? { value: lastHr.value, date: lastHr.date } : null, avg30: avg(hr.map((h) => h.value)) },
    weight: {
      latest: weight ? { value: weight.value, date: weight.date } : null,
      ownLatest: ownWeight ? { value: ownWeight.weightKg, date: ownWeight.date } : null,
    },
    workouts: workouts.map((w) => ({ id: w.id, date: w.date, source: w.source, detail: w.detail ? (JSON.parse(w.detail) as WorkoutDetail) : null })),
  };
}

export async function deleteHealthRecords() {
  const res = await prisma.healthRecord.deleteMany();
  return { deleted: res.count };
}
