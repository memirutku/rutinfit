/**
 * F77: Diyetisyene haftalık/aylık rapor. Yazdırılabilir sayfa (PDF olarak kaydedilir) ve Excel
 * aynı veriden üretilir: profil ve hedefler, günlük tablo, öğün günlüğü, kilo değişimi, takviyeler.
 */
import * as XLSX from "xlsx";
import { prisma } from "../prisma";
import { HttpError } from "../api-error";
import { addDaysToDateString, getLocalDateString, isDateString } from "../date-utils";
import { formatNumberTr } from "../format";
import { MEAL_TYPES, MEAL_TYPE_LABELS, type MealType } from "../schemas/enums";

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
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function buildDietitianReport(fromParam?: string | null, toParam?: string | null) {
  const { from, to, dayCount } = reportRange(fromParam, toParam);
  const range = { gte: from, lte: to };
  const [profile, logs, drinks, weights, cardio, sessions, supplements, supplementLogs] = await Promise.all([
    prisma.userProfile.findFirst(),
    prisma.foodLog.findMany({ where: { date: range }, orderBy: [{ date: "asc" }, { time: "asc" }] }),
    prisma.drinkLog.findMany({ where: { date: range } }),
    prisma.weightLog.findMany({ where: { date: range }, orderBy: { date: "asc" } }),
    prisma.cardioLog.findMany({ where: { date: range } }),
    prisma.workoutSession.findMany({ where: { date: range, completed: true } }),
    prisma.supplement.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.supplementLog.findMany({ where: { date: range, taken: true } }),
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
  const pick = (k: "kcal" | "protein" | "carbs" | "fat") => {
    const v = avg(logged.map((d) => d[k] as number));
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
    daysOnTarget: days.filter((d) => d.onTarget).length,
    averages: { kcal: pick("kcal"), protein: pick("protein"), carbs: pick("carbs"), fat: pick("fat"), waterMl: r0(avg(days.filter((d) => d.waterMl).map((d) => d.waterMl!)) ?? 0) || null },
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
    ["Kilo (başlangıç)", r.weight?.start ?? null],
    ["Kilo (son)", r.weight?.end ?? null],
    ["Kilo değişimi", r.weight?.change ?? null],
    ["Antrenman seansı", r.training.sessions],
    ["Kardiyo (dk)", r.training.cardioMin],
  ];
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
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
