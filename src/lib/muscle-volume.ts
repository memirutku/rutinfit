/**
 * F24: Kas grubu başına haftalık set sayısı. Hipertrofi için yaygın hedef aralığı haftada
 * 10–20 settir. Bir set, egzersizi o kası çalıştıran her kas grubuna sayılır (ısı haritasıyla
 * aynı eşleme).
 */
import { addDaysToDateString, startOfWeek } from "./date-utils";
import type { MuscleGroup } from "./muscles";
import { exerciseMatches, type SessionForLoad } from "./muscle-load";

export const VOLUME_TARGET = { min: 10, max: 20 } as const;

export type VolumeStatus = "low" | "ok" | "high";

export function volumeStatus(sets: number): VolumeStatus {
  if (sets < VOLUME_TARGET.min) return "low";
  if (sets > VOLUME_TARGET.max) return "high";
  return "ok";
}

export interface WeeklyVolume {
  /** Haftaların Pazartesi tarihleri, eskiden yeniye. */
  weeks: string[];
  rows: Array<{ muscleId: string; nameTr: string; sets: number[] }>;
}

export function weeklyMuscleSets(sessions: SessionForLoad[], groups: MuscleGroup[], today: string, weeks = 4): WeeklyVolume {
  const current = startOfWeek(today);
  const weekStarts = Array.from({ length: weeks }, (_, i) => addDaysToDateString(current, -7 * (weeks - 1 - i)));
  const done = sessions.filter((s) => s.completed !== false && s.date >= weekStarts[0] && s.date <= today);
  return {
    weeks: weekStarts,
    rows: groups.map((g) => {
      const sets = weekStarts.map(() => 0);
      for (const s of done) {
        const w = weekStarts.indexOf(startOfWeek(s.date));
        if (w === -1) continue;
        sets[w] += (s.setLogs ?? []).filter((set) => g.exercises.some((ex) => exerciseMatches(set.exerciseName, ex))).length;
      }
      return { muscleId: g.muscleId, nameTr: g.nameTr, sets };
    }),
  };
}
