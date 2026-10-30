import { addDaysToDateString } from "./date-utils";

/**
 * B07: Kilo hedefine ilerleme (panodaki "Kilo hedefim" kartı). Güncel kilo tekil tartı değil,
 * 7 günlük ortalamadır; günlük dalgalanma ilerlemeyi oynatmaz.
 */
export interface WeightGoalInput {
  /** Sihirbazda / ayarlarda girilen başlangıç kilosu. */
  startKg: number;
  targetKg: number | null;
  goalType: "lose" | "maintain" | "gain";
  rateKgPerWeek: number;
  latest: { weightKg: number; rollingAvg: number } | null;
  today: string;
}

export interface WeightGoalProgress {
  startKg: number;
  currentKg: number;
  targetKg: number;
  /** Hedef yönünde değişim (eksi: ters yönde). */
  changedKg: number;
  remainingKg: number;
  percent: number;
  weeksLeft: number | null;
  etaDate: string | null;
  reached: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function weightGoalProgress(input: WeightGoalInput): WeightGoalProgress | null {
  if (input.goalType === "maintain" || input.targetKg == null) return null;
  const sign = input.goalType === "lose" ? -1 : 1;
  const currentKg = round1(input.latest?.rollingAvg ?? input.startKg);
  const total = sign * (input.targetKg - input.startKg);
  const changedKg = round1(sign * (currentKg - input.startKg)) || 0; // -0 yerine 0
  const remainingKg = round1(Math.max(0, sign * (input.targetKg - currentKg)));
  const reached = remainingKg === 0;
  const percent = total > 0 ? Math.round(Math.min(100, Math.max(0, (changedKg / total) * 100))) : 100;
  const weeksLeft = !reached && input.rateKgPerWeek > 0 ? Math.ceil(remainingKg / input.rateKgPerWeek) : null;
  return {
    startKg: input.startKg,
    currentKg,
    targetKg: input.targetKg,
    changedKg,
    remainingKg,
    percent: reached ? 100 : percent,
    weeksLeft,
    etaDate: weeksLeft !== null ? addDaysToDateString(input.today, weeksLeft * 7) : null,
    reached,
  };
}
