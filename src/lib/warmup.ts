import { platesPerSide, type PlateCount } from "./plates";

export interface WarmupSet {
  weightKg: number;
  reps: number;
  /** Çalışma ağırlığının yüzdesi (boş bar için 0). */
  percent: number;
  plates: PlateCount[];
}

/** Boş bar × 10, ardından çalışma ağırlığının %40 × 5, %60 × 3, %80 × 2 ve (≥100 kg) %90 × 1'i. */
const STEPS = [
  { percent: 40, reps: 5 },
  { percent: 60, reps: 3 },
  { percent: 80, reps: 2 },
  { percent: 90, reps: 1, minWorking: 100 },
];

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * F22: Isınma setleri. Ağırlıklar 2,5 kg'a (her tarafa 1,25 kg) yuvarlanır; bara eşit ya da
 * altında kalan, çalışma ağırlığına ulaşan ve bir öncekini tekrarlayan adımlar atlanır.
 */
export function warmupSets(workingKg: number, barKg = 20): WarmupSet[] {
  if (!(workingKg > barKg)) return [];
  const sets: WarmupSet[] = [{ weightKg: barKg, reps: 10, percent: 0, plates: [] }];
  for (const step of STEPS) {
    if (step.minWorking && workingKg < step.minWorking) continue;
    const weightKg = roundTo((workingKg * step.percent) / 100, 2.5);
    const last = sets[sets.length - 1].weightKg;
    if (weightKg <= barKg || weightKg >= workingKg || weightKg <= last) continue;
    sets.push({ weightKg, reps: step.reps, percent: step.percent, plates: platesPerSide(weightKg, barKg).plates });
  }
  return sets;
}
