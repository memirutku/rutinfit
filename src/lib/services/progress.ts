import { addDaysToDateString } from '../date-utils';

export interface DatedWeight {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * Her kayıt için son 7 TAKVİM gününün (kayıt günü dahil) ortalaması.
 * Kayıt sayısına göre pencere almak, boş günlerde haftalarca geriye uzanırdı.
 */
export function computeWeightTrend(weights: DatedWeight[]) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((w) => {
    const from = addDaysToDateString(w.date, -6);
    const window = sorted.filter((x) => x.date >= from && x.date <= w.date).map((x) => x.weightKg);
    return { date: w.date, weightKg: w.weightKg, rollingAvg: round1(average(window) ?? w.weightKg) };
  });
}

/** Son 7 takvim gününün ortalaması − ondan önceki 7 günün ortalaması. Veri yoksa 0. */
export function computeWeeklyDelta(weights: DatedWeight[], today: string): number {
  const lastFrom = addDaysToDateString(today, -6);
  const prevFrom = addDaysToDateString(today, -13);
  const last = average(weights.filter((w) => w.date >= lastFrom && w.date <= today).map((w) => w.weightKg));
  const prev = average(weights.filter((w) => w.date >= prevFrom && w.date < lastFrom).map((w) => w.weightKg));
  return last !== null && prev !== null ? round1(last - prev) : 0;
}

/** Bugünden geriye 7 günün tarih listesi (eskiden yeniye). */
export function lastNDates(today: string, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => addDaysToDateString(today, i - (n - 1)));
}
