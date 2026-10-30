/**
 * F77: Diyetisyene haftalık/aylık rapor. Yazdırılabilir sayfa (PDF olarak kaydedilir) ve Excel
 * aynı veriden üretilir: profil ve hedefler, günlük tablo, öğün günlüğü, kilo değişimi, takviyeler.
 * B43: vücut ölçüleri (ilk/son/fark), haftalık plana uyum, öğün bazında plan–gerçekleşen ve
 * ortalamaların hedeften sapması.
 */
import * as XLSX from "xlsx";
import { prisma } from "../prisma";
import { HttpError } from "../api-error";
import { ADHERENCE_LABELS, computeAdherence, type Adherence, type AdherenceSummary } from "../adherence";
import { addDaysToDateString, getLocalDateString, isDateString, startOfWeek } from "../date-utils";
import { formatNumberTr } from "../format";
import { calculateRecipePortion } from "../nutrition-calculator";
import { MEAL_TYPES, MEAL_TYPE_LABELS, type MealType } from "../schemas/enums";
import { compareToTarget, deviationText, type TargetComparison } from "../report-targets";

export { compareToTarget, deviationText };
export type { DeviationStatus, TargetComparison, TargetMetric } from "../report-targets";

export const MAX_REPORT_DAYS = 92;

export function reportRange(from?: string | null, to?: string | null) {
  const end = to ?? getLocalDateString();
  const start = from ?? addDaysToDateString(end, -6);
  if (!isDateString(start) || !isDateString(end)) throw new HttpError("Tarih YYYY-AA-GG biçiminde olmalıdır.", 400);
  if (start > end) throw new HttpError("Başlangıç tarihi bitişten sonra olamaz.", 400);
  const dayCount = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  if (dayCount > MAX_REPORT_DAYS) throw new HttpError(`Rapor en çok ${MAX_REPORT_DAYS} günü kapsayabilir.`, 400);
  return { from: start, to: end, dayCount };
}

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/* ----------------------------- B43: vücut ölçüleri ----------------------------- */

const MEASUREMENT_FIELDS = [
  { key: "waistCm", label: "Bel", unit: "cm" },
  { key: "hipCm", label: "Kalça", unit: "cm" },
  { key: "chestCm", label: "Göğüs", unit: "cm" },
  { key: "armCm", label: "Kol", unit: "cm" },
  { key: "thighCm", label: "Bacak", unit: "cm" },
  { key: "neckCm", label: "Boyun", unit: "cm" },
  { key: "bodyFatPercent", label: "Yağ oranı", unit: "%" },
  { key: "restingHr", label: "Dinlenik nabız", unit: "atım/dk" },
  { key: "systolic", label: "Büyük tansiyon", unit: "mmHg" },
  { key: "diastolic", label: "Küçük tansiyon", unit: "mmHg" },
] as const;

export interface MeasurementRow {
  key: string;
  label: string;
  unit: string;
  first: { date: string; value: number };
  last: { date: string; value: number };
  /** Son − ilk; dönemde tek ölçüm varsa null. */
  change: number | null;
  count: number;
}

type MeasurementRecord = { date: string } & Partial<Record<(typeof MEASUREMENT_FIELDS)[number]["key"], number | null>>;

function measurementRow(key: string, label: string, unit: string, points: Array<{ date: string; value: number }>, round: (n: number) => number): MeasurementRow | null {
  if (!points.length) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return {
    key,
    label,
    unit,
    first: { date: first.date, value: round(first.value) },
    last: { date: last.date, value: round(last.value) },
    change: points.length > 1 ? round(last.value - first.value) : null,
    count: points.length,
  };
}

/** Dönemdeki ölçülerin ilk ve son değeri (tarihe göre sıralı kayıtlar). Bel ve kalça aynı gün ölçüldüyse oranı da eklenir. */
export function summarizeMeasurements(records: MeasurementRecord[]): MeasurementRow[] {
  const rows: MeasurementRow[] = [];
  for (const f of MEASUREMENT_FIELDS) {
    const points = records.filter((m) => typeof m[f.key] === "number").map((m) => ({ date: m.date, value: m[f.key] as number }));
    const row = measurementRow(f.key, f.label, f.unit, points, r1);
    if (row) rows.push(row);
  }
  const ratios = records
    .filter((m) => typeof m.waistCm === "number" && typeof m.hipCm === "number" && m.hipCm > 0)
    .map((m) => ({ date: m.date, value: (m.waistCm as number) / (m.hipCm as number) }));
  const ratio = measurementRow("waistHipRatio", "Bel/kalça oranı", "", ratios, r2);
  if (ratio) rows.push(ratio);
  return rows;
}

/* ------------------------- B43: plan ve gerçekleşen ------------------------- */

export interface WeekAdherence extends AdherenceSummary {
  weekStart: string;
  /** Haftanın rapor aralığına düşen ilk ve son günü. */
  from: string;
  to: string;
}

export interface PlanVsActualRow {
  date: string;
  mealType: string;
  mealLabel: string;
  /** Planlanan öğün(ler)in adı; plan dışı öğünde null. */
  planned: string | null;
  /** Tarifli plan öğünlerinin kalorisi; tarifsiz öğün varsa bilinmez (null). */
  plannedKcal: number | null;
  /** Günlüğe yazılan kalori; kayıt yoksa null. */
  actualKcal: number | null;
  actualCount: number;
  diffKcal: number | null;
  /** Plan öğünlerinin uyum işareti (birden çoksa en zayıfı). */
  adherence: Adherence | null;
}

const ADHERENCE_RANK: Record<Adherence, number> = { skipped: 0, partial: 1, done: 2 };
const mealLabel = (t: string) => MEAL_TYPE_LABELS[t as MealType] ?? t;

export async function buildDietitianReport(fromParam?: string | null, toParam?: string | null) {
  const { from, to, dayCount } = reportRange(fromParam, toParam);
  const range = { gte: from, lte: to };
  const [profile, logs, drinks, weights, cardio, sessions, supplements, supplementLogs, measurementRecords, plans] = await Promise.all([
    prisma.userProfile.findFirst(),
    prisma.foodLog.findMany({ where: { date: range }, orderBy: [{ date: "asc" }, { time: "asc" }] }),
    prisma.drinkLog.findMany({ where: { date: range } }),
    prisma.weightLog.findMany({ where: { date: range }, orderBy: { date: "asc" } }),
    prisma.cardioLog.findMany({ where: { date: range } }),
    prisma.workoutSession.findMany({ where: { date: range, completed: true } }),
    prisma.supplement.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.supplementLog.findMany({ where: { date: range, taken: true } }),
    prisma.bodyMeasurement.findMany({ where: { date: range }, orderBy: { date: "asc" } }),
    prisma.mealPlan.findMany({
      where: { date: range },
      orderBy: { date: "asc" },
      include: { meals: { include: { recipe: { include: { ingredients: { include: { foodItem: true } } } } } } },
    }),
  ]);
  const target = profile?.calorieTarget ?? null;
  const ceiling = profile?.calorieCeiling ?? (target !== null ? target + 100 : null);

  const days = Array.from({ length: dayCount }, (_, i) => {
    const date = addDaysToDateString(from, i);
    const mine = logs.filter((l) => l.date === date);
    const sum = (k: "caloriesSnapshot" | "proteinSnapshot" | "carbsSnapshot" | "fatSnapshot") => mine.reduce((a, l) => a + l[k], 0);
    const kcal = mine.length ? r0(sum("caloriesSnapshot")) : null;
    const water = drinks.filter((d) => d.date === date && d.kind !== "alcohol").reduce((a, d) => a + d.ml, 0);
    return {
      date,
      kcal,
      protein: mine.length ? r0(sum("proteinSnapshot")) : null,
      carbs: mine.length ? r0(sum("carbsSnapshot")) : null,
      fat: mine.length ? r0(sum("fatSnapshot")) : null,
      waterMl: water || null,
      weightKg: weights.find((w) => w.date === date)?.weightKg ?? null,
      workouts: sessions.filter((s) => s.date === date).length,
      cardioMin: r0(cardio.filter((c) => c.date === date).reduce((a, c) => a + c.durationMin, 0)),
      onTarget: kcal === null || target === null || ceiling === null ? null : kcal >= target * 0.9 && kcal <= ceiling,
    };
  });
  const logged = days.filter((d) => d.kcal !== null);
  // Recheck (Zeynep): bugün bitmediği için yarım gün ortalamaları düşürmez; başka kayıtlı gün yoksa bugün kullanılır.
  const todayStr = getLocalDateString();
  const finished = logged.filter((d) => d.date < todayStr);
  const averagesExcludeToday = finished.length > 0 && finished.length < logged.length;
  const basis = finished.length ? finished : logged;
  const pick = (k: "kcal" | "protein" | "carbs" | "fat") => {
    const v = avg(basis.map((d) => d[k] as number));
    return v === null ? null : r0(v);
  };

  const meals: Array<{ date: string; mealType: string; mealLabel: string; items: Array<{ time: string; name: string; grams: number; kcal: number; protein: number }> }> = [];
  for (const d of days) {
    for (const t of MEAL_TYPES) {
      const items = logs.filter((l) => l.date === d.date && l.mealType === t);
      if (items.length) {
        meals.push({
          date: d.date,
          mealType: t,
          mealLabel: MEAL_TYPE_LABELS[t as MealType],
          items: items.map((l) => ({ time: l.time, name: l.name, grams: r0(l.grams), kcal: r0(l.caloriesSnapshot), protein: r1(l.proteinSnapshot) })),
        });
      }
    }
  }

  // B43: haftalık plana uyum (rapor aralığına düşen günlerle sınırlı haftalar).
  const plannedMeals = plans.flatMap((p) => p.meals.map((m) => ({ ...m, date: p.date })));
  const weeks: WeekAdherence[] = [];
  for (let weekStart = startOfWeek(from); weekStart <= to; weekStart = addDaysToDateString(weekStart, 7)) {
    const wFrom = weekStart < from ? from : weekStart;
    const weekEnd = addDaysToDateString(weekStart, 6);
    const wTo = weekEnd > to ? to : weekEnd;
    weeks.push({ weekStart, from: wFrom, to: wTo, ...computeAdherence(plannedMeals.filter((m) => m.date >= wFrom && m.date <= wTo)) });
  }

  // B43: plan olan günlerde her öğün için plan ve gerçekleşen (plan dışı öğün de satır olur).
  const planVsActual: PlanVsActualRow[] = [];
  for (const plan of plans) {
    const dayLogs = logs.filter((l) => l.date === plan.date);
    const types = new Set([...plan.meals.map((m) => m.mealType), ...dayLogs.map((l) => l.mealType)]);
    const ordered = [...types].sort((a, b) => {
      const ia = MEAL_TYPES.indexOf(a as MealType);
      const ib = MEAL_TYPES.indexOf(b as MealType);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    for (const t of ordered) {
      const planned = plan.meals.filter((m) => m.mealType === t);
      const eaten = dayLogs.filter((l) => l.mealType === t);
      const kcals = planned.map((m) =>
        m.recipe
          ? calculateRecipePortion(m.recipe.ingredients.map((i) => ({ grams: i.grams, foodItem: i.foodItem })), m.recipe.servings, m.servings).macros.calories
          : null
      );
      const plannedKcal = planned.length && kcals.every((k) => k !== null) ? r0(kcals.reduce<number>((a, k) => a + (k as number), 0)) : null;
      const actualKcal = eaten.length ? r0(eaten.reduce((a, l) => a + l.caloriesSnapshot, 0)) : null;
      const marks = planned.map((m) => m.adherence).filter((a): a is Adherence => a === "done" || a === "partial" || a === "skipped");
      planVsActual.push({
        date: plan.date,
        mealType: t,
        mealLabel: mealLabel(t),
        planned: planned.length ? planned.map((m) => m.recipe?.name ?? m.customName ?? "Öğün").join(" + ") : null,
        plannedKcal,
        actualKcal,
        actualCount: eaten.length,
        diffKcal: plannedKcal !== null && actualKcal !== null ? actualKcal - plannedKcal : null,
        adherence: marks.length ? marks.reduce((w, a) => (ADHERENCE_RANK[a] < ADHERENCE_RANK[w] ? a : w)) : null,
      });
    }
  }

  const averages = { kcal: pick("kcal"), protein: pick("protein"), carbs: pick("carbs"), fat: pick("fat"), waterMl: r0(avg(days.filter((d) => d.waterMl).map((d) => d.waterMl!)) ?? 0) || null };
  const first = weights[0];
  const last = weights[weights.length - 1];
  return {
    from,
    to,
    dayCount,
    generatedAt: new Date().toISOString(),
    profile: profile
      ? {
          age: profile.age,
          sex: profile.sex,
          heightCm: profile.heightCm,
          currentWeightKg: profile.currentWeightKg,
          goalType: profile.goalType,
          calorieTarget: profile.calorieTarget,
          proteinTargetG: profile.proteinTargetG,
          carbTargetG: profile.carbTargetG,
          fatTargetG: profile.fatTargetG,
          waterTargetMl: profile.waterTargetMl,
          notes: profile.coachNotes,
        }
      : null,
    loggedDays: logged.length,
    /** Recheck: bugün kayıtlı ama gün bitmediği için ortalamalara katılmadı. */
    averagesExcludeToday,
    daysOnTarget: days.filter((d) => d.onTarget).length,
    averages,
    /** B43: ortalamaların hedeften sapması (profil ya da kayıt yoksa null). */
    targets: {
      kcal: compareToTarget("kcal", averages.kcal, target, ceiling),
      protein: compareToTarget("protein", averages.protein, profile?.proteinTargetG ?? null),
      carbs: compareToTarget("carbs", averages.carbs, profile?.carbTargetG ?? null),
      fat: compareToTarget("fat", averages.fat, profile?.fatTargetG ?? null),
    },
    measurements: summarizeMeasurements(measurementRecords),
    adherence: { overall: computeAdherence(plannedMeals), weeks },
    planVsActual,
    weight: first && last ? { start: first.weightKg, end: last.weightKg, change: r1(last.weightKg - first.weightKg) } : null,
    training: { sessions: sessions.length, cardioMin: r0(cardio.reduce((a, c) => a + c.durationMin, 0)) },
    days,
    meals,
    supplements: supplements
      .map((s) => ({ name: s.name, dose: `${formatNumberTr(s.doseAmount).replace(/\./g, "")} ${s.doseUnit}`, takenDays: supplementLogs.filter((l) => l.name === s.name).length }))
      .filter((s) => s.takenDays > 0),
  };
}
export type DietitianReport = Awaited<ReturnType<typeof buildDietitianReport>>;

const GOAL_TR: Record<string, string> = { lose: "Kilo vermek", maintain: "Korumak", gain: "Kilo almak" };

export function reportToXlsx(r: DietitianReport): Buffer {
  const wb = XLSX.utils.book_new();
  const summary: Array<[string, string | number | null]> = [
    ["Dönem", `${r.from} – ${r.to}`],
    ["Kayıtlı gün", `${r.loggedDays} / ${r.dayCount}`],
    ["Hedef aralığındaki gün", r.daysOnTarget],
    ["Ortalama kalori", r.averages.kcal],
    ["Ortalama protein (g)", r.averages.protein],
    ["Ortalama karbonhidrat (g)", r.averages.carbs],
    ["Ortalama yağ (g)", r.averages.fat],
    ["Ortalama sıvı (ml)", r.averages.waterMl],
    ...(r.averagesExcludeToday ? [["Not", "Bugün henüz bitmediği için ortalamalara katılmadı."] as [string, string]] : []),
    ["Kilo (başlangıç)", r.weight?.start ?? null],
    ["Kilo (son)", r.weight?.end ?? null],
    ["Kilo değişimi", r.weight?.change ?? null],
    ["Antrenman seansı", r.training.sessions],
    ["Kardiyo (dk)", r.training.cardioMin],
  ];
  const deviations: Array<[string, TargetComparison | null, string]> = [
    ["Ortalama kalori: hedeften fark", r.targets.kcal, "kcal"],
    ["Ortalama protein: hedeften fark", r.targets.protein, "g"],
    ["Ortalama karbonhidrat: hedeften fark", r.targets.carbs, "g"],
    ["Ortalama yağ: hedeften fark", r.targets.fat, "g"],
  ];
  for (const [label, c, unit] of deviations) if (c) summary.push([label, deviationText(c, unit)]);
  summary.push(["Plana uyum (dönem)", r.adherence.overall.percent === null ? "İşaretli öğün yok" : `%${r.adherence.overall.percent}`]);
  for (const m of r.measurements) {
    if (m.change !== null) summary.push([`${m.label} değişimi${m.unit ? ` (${m.unit})` : ""}`, m.change]);
  }
  if (r.profile) {
    summary.push(
      ["Yaş", r.profile.age],
      ["Cinsiyet", r.profile.sex === "female" ? "Kadın" : "Erkek"],
      ["Boy (cm)", r.profile.heightCm],
      ["Hedef", GOAL_TR[r.profile.goalType] ?? r.profile.goalType],
      ["Kalori hedefi", r.profile.calorieTarget],
      ["Protein hedefi (g)", r.profile.proteinTargetG],
      ["Notlar", r.profile.notes ?? ""]
    );
  }
  for (const s of r.supplements) summary.push([`Takviye: ${s.name} (${s.dose})`, `${s.takenDays} gün`]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Alan", "Değer"], ...summary]), "Özet");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      r.days.map((d) => ({
        Tarih: d.date,
        Kalori: d.kcal,
        "Protein (g)": d.protein,
        "Karbonhidrat (g)": d.carbs,
        "Yağ (g)": d.fat,
        "Sıvı (ml)": d.waterMl,
        "Kilo (kg)": d.weightKg,
        Antrenman: d.workouts,
        "Kardiyo (dk)": d.cardioMin,
        "Hedefte mi": d.onTarget === null ? "" : d.onTarget ? "Evet" : "Hayır",
      }))
    ),
    "Günlük"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      r.meals.flatMap((m) => m.items.map((i) => ({ Tarih: m.date, Öğün: m.mealLabel, Saat: i.time, Besin: i.name, Gram: i.grams, Kalori: i.kcal, "Protein (g)": i.protein })))
    ),
    "Öğün günlüğü"
  );
  // B43: diyetisyenin baktığı ek sayfalar. Boş sayfada başlık satırı yine yazılır.
  const sheet = (rows: Array<Record<string, unknown>>, header: string[]) => XLSX.utils.json_to_sheet(rows, { header });
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      r.measurements.map((m) => ({
        Ölçü: m.unit ? `${m.label} (${m.unit})` : m.label,
        İlk: m.first.value,
        "İlk tarih": m.first.date,
        Son: m.last.value,
        "Son tarih": m.last.date,
        Fark: m.change,
        "Ölçüm sayısı": m.count,
      })),
      ["Ölçü", "İlk", "İlk tarih", "Son", "Son tarih", "Fark", "Ölçüm sayısı"]
    ),
    "Ölçüler"
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      r.adherence.weeks.map((w) => ({
        Başlangıç: w.from,
        Bitiş: w.to,
        "Planlı öğün": w.planned,
        İşaretli: w.marked,
        Uygulandı: w.done,
        Kısmen: w.partial,
        Atlandı: w.skipped,
        "Uyum (%)": w.percent,
      })),
      ["Başlangıç", "Bitiş", "Planlı öğün", "İşaretli", "Uygulandı", "Kısmen", "Atlandı", "Uyum (%)"]
    ),
    "Plana uyum"
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      r.planVsActual.map((p) => ({
        Tarih: p.date,
        Öğün: p.mealLabel,
        Plan: p.planned ?? "Plan dışı",
        "Plan (kcal)": p.plannedKcal,
        "Gerçekleşen (kcal)": p.actualKcal,
        Fark: p.diffKcal,
        Uyum: p.adherence ? ADHERENCE_LABELS[p.adherence] : "",
      })),
      ["Tarih", "Öğün", "Plan", "Plan (kcal)", "Gerçekleşen (kcal)", "Fark", "Uyum"]
    ),
    "Plan ve gerçekleşen"
  );
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
