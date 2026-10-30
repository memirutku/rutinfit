import { formatDateTr } from "@/lib/format";
import type { WorkoutSession } from "@/lib/schemas/workout";
import { isWorkingSet } from "@/lib/set-types";

type SetLog = WorkoutSession["setLogs"][number];

/** B19: Setleri egzersize göre, set numarası sırasıyla gruplar (ilk görülen egzersiz önce). */
export function groupSetLogs<T extends Pick<SetLog, "exerciseName" | "setNumber">>(setLogs: T[]): Array<{ exerciseName: string; sets: T[] }> {
  const groups = new Map<string, T[]>();
  for (const s of setLogs) groups.set(s.exerciseName, [...(groups.get(s.exerciseName) ?? []), s]);
  return [...groups.entries()].map(([exerciseName, sets]) => ({
    exerciseName,
    sets: [...sets].sort((a, b) => a.setNumber - b.setNumber),
  }));
}

/** B19: Çalışma setlerinin hacmi (ağırlık × tekrar); ısınma setleri sayılmaz. */
export const sessionVolume = (s: Pick<WorkoutSession, "setLogs">) =>
  s.setLogs.filter((x) => isWorkingSet(x.setType)).reduce((sum, x) => sum + x.weightKg * x.reps, 0);

/** "Dünkü alt vücut · 29.10.2026": aynı adlı seanslar düğme adlarında karışmasın. */
export const sessionLabel = (s: Pick<WorkoutSession, "name" | "date">) => `${s.name} · ${formatDateTr(s.date)}`;
