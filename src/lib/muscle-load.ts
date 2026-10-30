import { addDaysToDateString } from "./date-utils";
import { normalizeName } from "./text";

export interface MuscleDefinition {
  muscleId: string;
  exercises: string[];
  weeklySets: number;
  lastTrainedDaysAgo?: number;
}

export interface SessionForLoad {
  date: string;
  completed?: boolean;
  setLogs?: Array<{ exerciseName: string }>;
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** "Bench Press (Barbell)" ↔ "Bench Press" gibi yazım farklarında da eşleşir. */
export function exerciseMatches(setName: string, exercise: string): boolean {
  const a = normalizeName(setName);
  const b = normalizeName(exercise);
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Son 7 günün (bugün dahil) tamamlanmış seanslarından her kas için set sayısını ve
 * son çalışılan günü hesaplar. Kayıt yoksa set 0, son gün tanımsız olur (sahte varsayılan yok).
 */
export function computeMuscleLoad<T extends MuscleDefinition>(
  muscles: T[],
  sessions: SessionForLoad[],
  today: string
): T[] {
  const from = addDaysToDateString(today, -6);
  const recent = sessions.filter((s) => s.completed !== false && s.date >= from && s.date <= today);

  return muscles.map((m) => {
    let sets = 0;
    let lastDaysAgo: number | undefined;
    for (const s of recent) {
      const hits = (s.setLogs ?? []).filter((set) => m.exercises.some((ex) => exerciseMatches(set.exerciseName, ex))).length;
      if (hits > 0) {
        sets += hits;
        const ago = daysBetween(s.date, today);
        lastDaysAgo = lastDaysAgo === undefined ? ago : Math.min(lastDaysAgo, ago);
      }
    }
    return { ...m, weeklySets: sets, lastTrainedDaysAgo: lastDaysAgo };
  });
}
