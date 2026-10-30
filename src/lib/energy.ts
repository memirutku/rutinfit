/**
 * F09: Enerji ihtiyacı ve hedef planı. Mifflin-St Jeor BMR × aktivite katsayısı = TDEE.
 * Hedefler F56 güvenlik kurallarından geçer (kalori tabanı, haftalık kayıp sınırı).
 */
import { addDaysToDateString } from "./date-utils";
import { formatNumberTr } from "./format";
import { calorieFloor, maxWeeklyLossKg } from "./safety";

export const ACTIVITY_LEVELS = {
  sedentary: { factor: 1.2, label: "Hareketsiz", hint: "Masa başı iş, egzersiz yok" },
  light: { factor: 1.375, label: "Hafif hareketli", hint: "Haftada 1–3 gün egzersiz" },
  moderate: { factor: 1.55, label: "Orta hareketli", hint: "Haftada 3–5 gün egzersiz" },
  active: { factor: 1.725, label: "Çok hareketli", hint: "Haftada 6–7 gün egzersiz" },
  very_active: { factor: 1.9, label: "Aşırı hareketli", hint: "Ağır fiziksel iş ve antrenman" },
} as const;
export type ActivityLevel = keyof typeof ACTIVITY_LEVELS;
export const ACTIVITY_LEVEL_KEYS = Object.keys(ACTIVITY_LEVELS) as ActivityLevel[];

export const GOAL_TYPES = { lose: "Kilo ver", maintain: "Kiloyu koru", gain: "Kilo al" } as const;
export type GoalType = keyof typeof GOAL_TYPES;

/** 1 kg vücut ağırlığı ≈ 7.700 kcal. */
const KCAL_PER_KG = 7700;
/** Kilo almada haftalık üst sınır (yağ kazanımını sınırlamak için). */
const MAX_WEEKLY_GAIN_KG = 0.5;
const PROTEIN_G_PER_KG = 1.8;
const FAT_SHARE = 0.27;

export interface BodyInput {
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
}

export interface EnergyInput extends BodyInput {
  activityLevel: ActivityLevel;
  goalType: GoalType;
  goalRateKgPerWeek: number;
  targetWeightKg?: number | null;
}

export interface EnergyPlan {
  bmr: number;
  tdee: number;
  /** Uygulanan haftalık hız (sınırlandıktan sonra). */
  rateKgPerWeek: number;
  rateCapped: boolean;
  floorApplied: boolean;
  calorieTarget: number;
  calorieCeiling: number;
  proteinTargetG: number;
  fatTargetG: number;
  carbTargetG: number;
  weeksToGoal: number | null;
  etaDate: string | null;
  notes: string[];
}

export function bmrMifflin({ sex, age, heightCm, weightKg }: BodyInput): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

const round10 = (n: number) => Math.round(n / 10) * 10;

export function planTargets(input: EnergyInput, today: string): EnergyPlan {
  const notes: string[] = [];
  const bmr = bmrMifflin(input);
  const tdee = Math.round(bmr * ACTIVITY_LEVELS[input.activityLevel].factor);
  const floor = calorieFloor(input.sex);

  let rate = 0;
  let rateCapped = false;
  if (input.goalType === "lose") {
    const cap = maxWeeklyLossKg(input.weightKg);
    rate = Math.min(input.goalRateKgPerWeek, cap);
    rateCapped = input.goalRateKgPerWeek > cap;
    if (rateCapped) notes.push(`Haftalık kayıp, vücut ağırlığının %1'i olan ${formatNumberTr(cap)} kg ile sınırlandı.`);
  } else if (input.goalType === "gain") {
    rate = Math.min(input.goalRateKgPerWeek, MAX_WEEKLY_GAIN_KG);
    rateCapped = input.goalRateKgPerWeek > MAX_WEEKLY_GAIN_KG;
    if (rateCapped) notes.push(`Haftalık artış ${formatNumberTr(MAX_WEEKLY_GAIN_KG)} kg ile sınırlandı.`);
  }

  const sign = input.goalType === "lose" ? -1 : input.goalType === "gain" ? 1 : 0;
  let calorieTarget = round10(tdee + (sign * rate * KCAL_PER_KG) / 7);
  let floorApplied = false;
  if (calorieTarget < floor) {
    calorieTarget = floor;
    floorApplied = true;
    // Tabanda gerçekleşebilecek hız.
    rate = input.goalType === "lose" ? Math.max(0, ((tdee - floor) * 7) / KCAL_PER_KG) : rate;
    notes.push(
      rate > 0
        ? `Kalori hedefi güvenli taban olan ${formatNumberTr(floor)} kcal'a çekildi; beklenen hız haftada yaklaşık ${formatNumberTr(rate)} kg.`
        : `Kalori hedefi güvenli taban olan ${formatNumberTr(floor)} kcal'a çekildi. Bu tabanla kilo kaybı beklenmez; bir uzmana danışmanı öneririz.`
    );
  }

  // Protein: kilo verirken hedef kilo, aksi hâlde BMI 25'teki kilo ile mevcut kilodan küçüğü.
  const bmi25Weight = 25 * (input.heightCm / 100) ** 2;
  const target = input.targetWeightKg ?? null;
  const refWeight =
    input.goalType === "lose" && target !== null && target < input.weightKg ? target : Math.min(input.weightKg, bmi25Weight);
  const proteinTargetG = Math.round(PROTEIN_G_PER_KG * refWeight);
  const fatTargetG = Math.round((calorieTarget * FAT_SHARE) / 9);
  const carbTargetG = Math.max(0, Math.round((calorieTarget - proteinTargetG * 4 - fatTargetG * 9) / 4));

  let weeksToGoal: number | null = null;
  let etaDate: string | null = null;
  const distance = target === null ? 0 : sign * (target - input.weightKg);
  if (target !== null && sign !== 0 && rate > 0 && distance > 0) {
    weeksToGoal = Math.ceil(distance / rate);
    etaDate = addDaysToDateString(today, weeksToGoal * 7);
  }

  return {
    bmr: Math.round(bmr),
    tdee,
    rateKgPerWeek: Math.round(rate * 100) / 100,
    rateCapped,
    floorApplied,
    calorieTarget,
    calorieCeiling: calorieTarget + 100,
    proteinTargetG,
    fatTargetG,
    carbTargetG,
    weeksToGoal,
    etaDate,
    notes,
  };
}
