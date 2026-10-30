import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { estimate1Rm, exerciseHistory, personalRecords } from "@/lib/strength";
import { normalizeName } from "@/lib/text";

/**
 * F23: Güç gelişimi. Parametresiz: egzersiz listesi (son kullanıma göre). `?exercise=`:
 * o egzersizin gün gün geçmişi ve rekorları. Yalnız tamamlanmış seanslar sayılır.
 */
export async function GET(req: Request) {
  try {
    const exercise = new URL(req.url).searchParams.get("exercise");
    const rows = await prisma.setLog.findMany({
      where: { session: { completed: true } },
      select: { exerciseName: true, weightKg: true, reps: true, session: { select: { date: true } } },
    });
    const sets = rows.map((r) => ({ key: normalizeName(r.exerciseName), name: r.exerciseName, date: r.session.date, weightKg: r.weightKg, reps: r.reps }));

    if (exercise) {
      const key = normalizeName(exercise);
      const mine = sets.filter((s) => s.key === key);
      const history = exerciseHistory(mine);
      return NextResponse.json({ name: mine.at(-1)?.name ?? exercise, history, prs: personalRecords(history, mine) });
    }

    const byKey = new Map<string, { name: string; dates: Set<string>; lastDate: string; bestE1rm: number }>();
    for (const s of sets) {
      const e = byKey.get(s.key) ?? { name: s.name, dates: new Set<string>(), lastDate: s.date, bestE1rm: 0 };
      e.dates.add(s.date);
      if (s.date >= e.lastDate) {
        e.lastDate = s.date;
        e.name = s.name; // en son yazım
      }
      e.bestE1rm = Math.max(e.bestE1rm, estimate1Rm(s.weightKg, s.reps));
      byKey.set(s.key, e);
    }
    const exercises = [...byKey.values()]
      .map((e) => ({ name: e.name, sessions: e.dates.size, lastDate: e.lastDate, bestE1rm: e.bestE1rm }))
      .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.sessions - a.sessions);
    return NextResponse.json({ exercises });
  } catch (error) {
    return apiError(error, "Güç verileri getirilemedi", "Strength GET");
  }
}
