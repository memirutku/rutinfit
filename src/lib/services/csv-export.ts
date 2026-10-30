/**
 * F60: CSV dışa aktarma. Biçimler docs/CSV_FORMATS.md'de belgelidir. Sayılar noktalı ondalıkla
 * yazılır (tablolama programları ve diğer uygulamalarla uyum için). Antrenman dosyası Strong
 * biçimindedir ve RutinFit'e geri içe aktarılabilir.
 */
import { prisma } from "../prisma";
import { toCsv } from "../csv";
import { MEAL_TYPE_LABELS, type MealType } from "../schemas/enums";

export const CSV_EXPORT_TYPES = {
  "food-log": "besin-gunlugu",
  workouts: "antrenmanlar",
  body: "vucut-olculeri",
} as const;
export type CsvExportType = keyof typeof CSV_EXPORT_TYPES;

interface Range {
  from?: string;
  to?: string;
}

const dateWhere = ({ from, to }: Range) => (from || to ? { date: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {});

export async function foodLogCsv(range: Range): Promise<string> {
  const logs = await prisma.foodLog.findMany({ where: dateWhere(range), orderBy: [{ date: "asc" }, { time: "asc" }, { createdAt: "asc" }] });
  return toCsv(
    ["date", "time", "meal", "name", "grams", "kcal", "protein_g", "carbs_g", "fat_g"],
    logs.map((l) => [
      l.date,
      l.time,
      MEAL_TYPE_LABELS[l.mealType as MealType] ?? l.mealType,
      l.name,
      l.grams,
      l.caloriesSnapshot,
      l.proteinSnapshot,
      l.carbsSnapshot,
      l.fatSnapshot,
    ])
  );
}

/** Strong uygulamasının dışa aktarma başlıkları; ağırlık kg'dır. */
const STRONG_HEADERS = ["Date", "Workout Name", "Duration", "Exercise Name", "Set Order", "Weight", "Reps", "Distance", "Seconds", "Notes", "Workout Notes", "RPE"];

export async function workoutsCsv(range: Range): Promise<string> {
  const sessions = await prisma.workoutSession.findMany({
    where: { completed: true, ...dateWhere(range) },
    include: { setLogs: { orderBy: [{ exerciseName: "asc" }, { setNumber: "asc" }] } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return toCsv(
    STRONG_HEADERS,
    sessions.flatMap((s) =>
      s.setLogs.map((set) => [
        `${s.date} 00:00:00`,
        s.name,
        `${s.durationMinutes}m`,
        set.exerciseName,
        set.setNumber,
        set.weightKg,
        set.reps,
        "",
        "",
        "",
        s.notes ?? "",
        set.rpe ?? "",
      ])
    )
  );
}

export async function bodyCsv(range: Range): Promise<string> {
  const [weights, waists] = await Promise.all([
    prisma.weightLog.findMany({ where: dateWhere(range) }),
    prisma.bodyMeasurement.findMany({ where: dateWhere(range) }),
  ]);
  const byDate = new Map<string, { weight?: number; waist?: number }>();
  for (const w of weights) byDate.set(w.date, { ...byDate.get(w.date), weight: w.weightKg });
  for (const m of waists) if (m.waistCm != null) byDate.set(m.date, { ...byDate.get(m.date), waist: m.waistCm });
  return toCsv(
    ["date", "weight_kg", "waist_cm"],
    [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => [date, v.weight, v.waist])
  );
}

export const CSV_BUILDERS: Record<CsvExportType, (range: Range) => Promise<string>> = {
  "food-log": foodLogCsv,
  workouts: workoutsCsv,
  body: bodyCsv,
};
