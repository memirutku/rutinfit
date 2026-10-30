/**
 * F23: Güç gelişimi. e1RM (tahmini tek tekrar maksimumu) Epley formülüyle hesaplanır:
 * ağırlık × (1 + tekrar / 30); tek tekrarda ağırlığın kendisi.
 */
const round1 = (n: number) => Math.round(n * 10) / 10;

export function estimate1Rm(weightKg: number, reps: number): number {
  if (!(weightKg > 0) || !(reps > 0)) return 0;
  return reps === 1 ? weightKg : round1(weightKg * (1 + reps / 30));
}

export interface SetPoint {
  date: string;
  weightKg: number;
  reps: number;
}

export interface ExerciseDay {
  date: string;
  /** e1RM'i en yüksek set. */
  topSet: { weightKg: number; reps: number };
  e1rm: number;
  volumeKg: number;
  sets: number;
}

/** Gün gün en iyi set, hacim (ağırlık × tekrar) ve set sayısı; tarihe göre artan. */
export function exerciseHistory(sets: SetPoint[]): ExerciseDay[] {
  const byDate = new Map<string, SetPoint[]>();
  for (const s of sets) {
    if (!(s.reps > 0)) continue;
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySets]) => {
      const top = daySets.reduce((best, s) =>
        estimate1Rm(s.weightKg, s.reps) > estimate1Rm(best.weightKg, best.reps) ? s : best
      );
      return {
        date,
        topSet: { weightKg: top.weightKg, reps: top.reps },
        e1rm: estimate1Rm(top.weightKg, top.reps),
        volumeKg: round1(daySets.reduce((a, s) => a + s.weightKg * s.reps, 0)),
        sets: daySets.length,
      };
    });
}

export interface PersonalRecords {
  bestE1rm: { value: number; date: string; weightKg: number; reps: number } | null;
  heaviest: { weightKg: number; reps: number; date: string } | null;
  bestVolume: { volumeKg: number; date: string } | null;
  /** Ağırlıksız (vücut ağırlığı) egzersizlerde en çok tekrar. */
  mostReps: { reps: number; date: string } | null;
}

export function personalRecords(days: ExerciseDay[], sets: SetPoint[]): PersonalRecords {
  const weighted = sets.filter((s) => s.weightKg > 0 && s.reps > 0);
  const bestDay = days.filter((d) => d.e1rm > 0).reduce<ExerciseDay | null>((b, d) => (!b || d.e1rm > b.e1rm ? d : b), null);
  const heaviest = weighted.reduce<SetPoint | null>(
    (b, s) => (!b || s.weightKg > b.weightKg || (s.weightKg === b.weightKg && s.reps > b.reps) ? s : b),
    null
  );
  const volumeDay = days.filter((d) => d.volumeKg > 0).reduce<ExerciseDay | null>((b, d) => (!b || d.volumeKg > b.volumeKg ? d : b), null);
  const repsSet = weighted.length
    ? null
    : sets.filter((s) => s.reps > 0).reduce<SetPoint | null>((b, s) => (!b || s.reps > b.reps ? s : b), null);
  return {
    bestE1rm: bestDay ? { value: bestDay.e1rm, date: bestDay.date, ...bestDay.topSet } : null,
    heaviest: heaviest ? { weightKg: heaviest.weightKg, reps: heaviest.reps, date: heaviest.date } : null,
    bestVolume: volumeDay ? { volumeKg: volumeDay.volumeKg, date: volumeDay.date } : null,
    mostReps: repsSet ? { reps: repsSet.reps, date: repsSet.date } : null,
  };
}

export interface Plateau {
  sessions: number;
  bestE1rm: number;
  message: string;
}

/**
 * F21: Son `window` seansta (varsayılan 3) e1RM önceki en iyiyi geçmediyse durağanlık.
 * Karar için en az window + 1 seans gerekir.
 */
export function detectPlateau(history: ExerciseDay[], window = 3): Plateau | null {
  const days = history.filter((d) => d.e1rm > 0);
  if (days.length < window + 1) return null;
  const before = Math.max(...days.slice(0, -window).map((d) => d.e1rm));
  const recent = Math.max(...days.slice(-window).map((d) => d.e1rm));
  if (recent > before) return null;
  return {
    sessions: window,
    bestE1rm: before,
    message: `Son ${window} seansta yeni rekor yok. Bir hafta ağırlığı yaklaşık %10 azaltıp toparlan (deload) ya da tekrar aralığını değiştirmeyi dene.`,
  };
}
