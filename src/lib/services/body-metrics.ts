/**
 * F16: Vücut ölçüleri ve sağlık metrikleri. Her alan isteğe bağlı; aynı güne verilen alanlar
 * birleşir. Uyarılar teşhis değildir; yalnız tekrar ölçmeyi ya da hekime danışmayı önerir.
 */
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../api-error";
import { addDaysToDateString, getLocalDateString } from "../date-utils";

const num = (min: number, max: number) => z.number().min(min).max(max).nullable().optional();
const int = (min: number, max: number) => z.number().int().min(min).max(max).nullable().optional();

export const BODY_METRIC_FIELDS = ["waistCm", "hipCm", "chestCm", "armCm", "thighCm", "neckCm", "bodyFatPercent", "restingHr", "systolic", "diastolic"] as const;
export type BodyMetricField = (typeof BODY_METRIC_FIELDS)[number];

export const BodyMetricsInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Tarih geçersiz."),
    waistCm: num(30, 250),
    hipCm: num(40, 250),
    chestCm: num(40, 250),
    armCm: num(10, 80),
    thighCm: num(20, 120),
    neckCm: num(20, 70),
    bodyFatPercent: num(2, 70),
    restingHr: int(25, 220),
    systolic: int(60, 260),
    diastolic: int(30, 160),
    notes: z.string().trim().max(300).nullable().optional(),
  })
  .refine((v) => v.systolic == null || v.diastolic == null || v.systolic > v.diastolic, {
    message: "Büyük tansiyon küçük tansiyondan yüksek olmalı.",
    path: ["systolic"],
  });
export type BodyMetricsInput = z.infer<typeof BodyMetricsInputSchema>;

export async function saveBodyMetrics(input: BodyMetricsInput) {
  const { date, ...fields } = input;
  // undefined alanlar dokunulmaz; null verilenler silinir.
  const data = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  return prisma.bodyMeasurement.upsert({ where: { date }, update: data, create: { date, ...data } });
}

export async function deleteBodyMetrics(date: string) {
  const res = await prisma.bodyMeasurement.deleteMany({ where: { date } });
  if (res.count === 0) throw new HttpError("Bu güne ait ölçü yok.", 404);
}

export type BloodPressureLevel = "low" | "normal" | "elevated" | "high" | "very_high";

export function classifyBloodPressure(systolic: number, diastolic: number): { level: BloodPressureLevel; message: string } {
  if (systolic >= 180 || diastolic >= 120)
    return { level: "very_high", message: "Çok yüksek ölçüm. Baş ağrısı, göğüs ağrısı, nefes darlığı ya da görme bozukluğu varsa hemen 112'yi ara; yoksa dinlenip tekrar ölç ve aynı gün hekimine danış." };
  if (systolic >= 140 || diastolic >= 90) return { level: "high", message: "Yüksek ölçüm. 5 dakika oturup dinlendikten sonra tekrar ölç; sık tekrarlıyorsa hekimine danış." };
  if (systolic >= 130 || diastolic >= 85) return { level: "elevated", message: "Normalin üst sınırında. Düzenli ölçmeye devam et." };
  if (systolic < 90 || diastolic < 60) return { level: "low", message: "Düşük ölçüm. Baş dönmesi ya da bayılma hissi varsa hekimine danış." };
  return { level: "normal", message: "Normal aralıkta." };
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export async function getBodyMetrics(from?: string, to?: string) {
  const end = to ?? getLocalDateString();
  const start = from ?? addDaysToDateString(end, -364);
  const [entries, profile] = await Promise.all([
    prisma.bodyMeasurement.findMany({ where: { date: { gte: start, lte: end } }, orderBy: { date: "asc" } }),
    prisma.userProfile.findFirst({ select: { heightCm: true } }),
  ]);

  const latest: Partial<Record<BodyMetricField, { value: number; date: string }>> = {};
  const changes: Partial<Record<BodyMetricField, { from: number; to: number; delta: number }>> = {};
  for (const field of BODY_METRIC_FIELDS) {
    const points = entries.filter((e) => e[field] != null).map((e) => ({ date: e.date, value: e[field] as number }));
    if (!points.length) continue;
    const last = points[points.length - 1];
    latest[field] = last;
    if (points.length > 1) changes[field] = { from: points[0].value, to: last.value, delta: round(last.value - points[0].value) };
  }

  const waist = latest.waistCm?.value;
  const waistToHeight =
    waist && profile?.heightCm ? { ratio: round(waist / profile.heightCm, 2), elevated: waist / profile.heightCm >= 0.5 } : null;

  // Tansiyon: iki değerin birlikte girildiği en son gün.
  const bpEntry = [...entries].reverse().find((e) => e.systolic != null && e.diastolic != null);
  const bloodPressure = bpEntry
    ? { date: bpEntry.date, systolic: bpEntry.systolic!, diastolic: bpEntry.diastolic!, ...classifyBloodPressure(bpEntry.systolic!, bpEntry.diastolic!) }
    : null;

  return { from: start, to: end, entries, latest, changes, waistToHeight, bloodPressure };
}
