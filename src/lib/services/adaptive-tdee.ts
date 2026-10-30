/** F10: Adaptif TDEE için veriyi toplar; F09 formülüyle karşılaştırır ve gerekçeli hedef önerir. */
import { prisma } from "../prisma";
import { addDaysToDateString, getLocalDateString } from "../date-utils";
import { estimateAdaptiveTdee } from "../adaptive-tdee";
import { ACTIVITY_LEVEL_KEYS, planTargets, type ActivityLevel, type GoalType } from "../energy";
import { formatNumberTr } from "../format";
import { calorieFloor, maxWeeklyLossKg } from "../safety";

/** Hedefin değişmesi önerilen en küçük fark (kcal). */
export const SUGGESTION_THRESHOLD = 100;

export async function loadAdaptiveTdee(today = getLocalDateString()) {
  const from = addDaysToDateString(today, -21);
  const [logs, weights, profile] = await Promise.all([
    prisma.foodLog.groupBy({ by: ["date"], where: { date: { gte: from, lt: today } }, _sum: { caloriesSnapshot: true } }),
    prisma.weightLog.findMany({ where: { date: { gte: from, lt: today } } }),
    prisma.userProfile.findFirst(),
  ]);
  const result = estimateAdaptiveTdee({
    today,
    intakes: logs.map((l) => ({ date: l.date, kcal: l._sum.caloriesSnapshot ?? 0 })),
    weights: weights.map((w) => ({ date: w.date, kg: w.weightKg })),
  });
  if (!result.ok || !profile) return { ...result, formulaTdee: null, currentTarget: profile?.calorieTarget ?? null, suggestion: null };

  const activity = ACTIVITY_LEVEL_KEYS.includes(profile.activityLevel as ActivityLevel) ? (profile.activityLevel as ActivityLevel) : "light";
  const goalType = (["lose", "maintain", "gain"].includes(profile.goalType) ? profile.goalType : "lose") as GoalType;
  const formulaTdee = planTargets(
    { sex: profile.sex, age: profile.age, heightCm: profile.heightCm, weightKg: profile.currentWeightKg, activityLevel: activity, goalType, goalRateKgPerWeek: profile.goalRateKgPerWeek },
    today
  ).tdee;

  // Hedef: tahmini harcama ± hız; F56 sınırları (kayıp %1/hafta, kalori tabanı).
  const rate = goalType === "lose" ? Math.min(profile.goalRateKgPerWeek, maxWeeklyLossKg(profile.currentWeightKg)) : goalType === "gain" ? Math.min(profile.goalRateKgPerWeek, 0.5) : 0;
  const sign = goalType === "lose" ? -1 : goalType === "gain" ? 1 : 0;
  const target = Math.max(calorieFloor(profile.sex), Math.round((result.tdee + (sign * rate * 7700) / 7) / 10) * 10);
  const delta = target - profile.calorieTarget;
  const goalText = sign === 0 ? "kiloyu korumak" : `haftada ${formatNumberTr(rate)} kg ${sign < 0 ? "kayıp" : "artış"}`;
  const suggestion =
    Math.abs(delta) >= SUGGESTION_THRESHOLD
      ? {
          calorieTarget: target,
          delta,
          reason: `Son ${result.windowDays} günde tahmini harcaman ${formatNumberTr(result.tdee)} kcal; ${goalText} için günlük ${formatNumberTr(target)} kcal uygun.`,
        }
      : null;
  return { ...result, formulaTdee, currentTarget: profile.calorieTarget, suggestion };
}
