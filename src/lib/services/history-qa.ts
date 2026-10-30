/** F50: Sabit tipli geçmiş sorguları. Sayılar her zaman veritabanından hesaplanır. */
import { prisma } from "../prisma";
import { formatDateTr, formatNumberTr } from "../format";
import { foldTr } from "../food-search";
import { detectHistoryQuery, type DateRange, type HistoryQueryType } from "../history-qa";
import { exerciseHistory, personalRecords } from "../strength";
import { EXERCISE_LIBRARY } from "../exercise-library";
import { summarizeDrinks } from "../drinks";

export interface DataAnswer {
  type: HistoryQueryType;
  title: string;
  answer: string;
  rows: Array<{ label: string; value: string }>;
  chart?: Array<{ x: string; y: number }>;
  range: DateRange;
}

const n = (v: number) => formatNumberTr(Math.round(v * 10) / 10);
const signed = (v: number) => (v < 0 ? `−${n(-v)}` : v > 0 ? `+${n(v)}` : "0");
const TITLES: Record<HistoryQueryType, string> = {
  avg_calories: "Ortalama kalori",
  avg_protein: "Ortalama protein",
  weight_change: "Kilo değişimi",
  workouts_count: "Antrenmanlar",
  best_lift: "Rekorlar",
  top_foods: "En çok yenenler",
  water_avg: "Sıvı",
  cardio_total: "Kardiyo",
};

async function dailyTotals(range: DateRange) {
  const rows = await prisma.foodLog.groupBy({
    by: ["date"],
    where: { date: { gte: range.from, lte: range.to } },
    _sum: { caloriesSnapshot: true, proteinSnapshot: true },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({ date: r.date, kcal: r._sum.caloriesSnapshot ?? 0, protein: r._sum.proteinSnapshot ?? 0 }));
}

export async function answerHistoryQuestion(question: string, today: string): Promise<DataAnswer | null> {
  const q = detectHistoryQuery(question, today);
  if (!q) return null;
  const { type, range } = q;
  const base = { type, range, title: `${TITLES[type]} · ${range.label}` };
  const empty = (): DataAnswer => ({ ...base, answer: `${range.label} için kayıt yok.`, rows: [] });
  const where = { date: { gte: range.from, lte: range.to } };

  switch (type) {
    case "avg_calories":
    case "avg_protein": {
      const days = await dailyTotals(range);
      if (!days.length) return empty();
      const profile = await prisma.userProfile.findFirst();
      const isKcal = type === "avg_calories";
      const value = (d: (typeof days)[number]) => (isKcal ? d.kcal : d.protein);
      const avg = days.reduce((a, d) => a + value(d), 0) / days.length;
      const target = isKcal ? profile?.calorieTarget : profile?.proteinTargetG;
      const unit = isKcal ? "kcal" : "g";
      return {
        ...base,
        answer: `${range.label} ${days.length} kayıtlı günde ortalama ${n(avg)} ${unit} ${isKcal ? "aldın" : "protein aldın"}${target ? ` (hedef ${n(target)} ${unit})` : ""}.`,
        rows: days.map((d) => ({ label: formatDateTr(d.date), value: `${n(value(d))} ${unit}` })),
        chart: days.map((d) => ({ x: formatDateTr(d.date, { short: true }), y: Math.round(value(d)) })),
      };
    }
    case "weight_change": {
      const ws = await prisma.weightLog.findMany({ where, orderBy: { date: "asc" } });
      if (ws.length < 2) return ws.length ? { ...base, answer: `${range.label} yalnız bir tartı var: ${n(ws[0].weightKg)} kg.`, rows: [] } : empty();
      const first = ws[0];
      const last = ws[ws.length - 1];
      return {
        ...base,
        answer: `${range.label}: ${n(first.weightKg)} kg → ${n(last.weightKg)} kg (${signed(last.weightKg - first.weightKg)} kg), ${ws.length} tartı.`,
        rows: ws.map((w) => ({ label: formatDateTr(w.date), value: `${n(w.weightKg)} kg` })),
        chart: ws.map((w) => ({ x: formatDateTr(w.date, { short: true }), y: w.weightKg })),
      };
    }
    case "workouts_count": {
      const sessions = await prisma.workoutSession.findMany({ where: { ...where, completed: true }, orderBy: { date: "asc" }, include: { _count: { select: { setLogs: true } } } });
      if (!sessions.length) return empty();
      return {
        ...base,
        answer: `${range.label} ${sessions.length} antrenman tamamladın.`,
        rows: sessions.map((s) => ({ label: formatDateTr(s.date), value: `${s.name} · ${s._count.setLogs} set` })),
      };
    }
    case "best_lift": {
      const names = (await prisma.setLog.findMany({ distinct: ["exerciseName"], select: { exerciseName: true } })).map((r) => r.exerciseName);
      const fq = foldTr(question);
      const candidates = [...names, ...EXERCISE_LIBRARY.flatMap((e) => [e.name, e.nameTr])];
      const target = candidates.filter((c) => fq.includes(foldTr(c))).sort((a, b) => b.length - a.length)[0];
      if (!target) return { ...base, answer: "Hangi egzersizin rekorunu istediğini anlayamadım; egzersiz adını yaz (ör. bench press rekorum).", rows: [] };
      const key = foldTr(target);
      const rows = await prisma.setLog.findMany({
        where: { session: { completed: true }, setType: { not: "warmup" } },
        select: { exerciseName: true, weightKg: true, reps: true, session: { select: { date: true } } },
      });
      const sets = rows.filter((r) => foldTr(r.exerciseName) === key || foldTr(r.exerciseName).includes(key)).map((r) => ({ date: r.session.date, weightKg: r.weightKg, reps: r.reps }));
      if (!sets.length) return { ...base, answer: `${target} için kayıtlı set yok.`, rows: [] };
      const history = exerciseHistory(sets);
      const pr = personalRecords(history, sets);
      const parts = [
        pr.bestE1rm && `en iyi e1RM ${n(pr.bestE1rm.value)} kg (${n(pr.bestE1rm.weightKg)} kg × ${pr.bestE1rm.reps}, ${formatDateTr(pr.bestE1rm.date)})`,
        pr.heaviest && `en ağır set ${n(pr.heaviest.weightKg)} kg × ${pr.heaviest.reps}`,
      ].filter(Boolean);
      return {
        ...base,
        title: `${TITLES[type]} · ${target}`,
        answer: `${target}: ${parts.join("; ")}.`,
        rows: history.slice(-8).map((d) => ({ label: formatDateTr(d.date), value: `${n(d.topSet.weightKg)} kg × ${d.topSet.reps} (e1RM ${n(d.e1rm)})` })),
        chart: history.map((d) => ({ x: formatDateTr(d.date, { short: true }), y: d.e1rm })),
      };
    }
    case "top_foods": {
      const top = await prisma.foodLog.groupBy({ by: ["name"], where, _count: { _all: true }, orderBy: { _count: { name: "desc" } }, take: 5 });
      if (!top.length) return empty();
      return { ...base, answer: `${range.label} en sık: ${top.map((t) => t.name).join(", ")}.`, rows: top.map((t) => ({ label: t.name, value: `${t._count._all} kez` })) };
    }
    case "water_avg": {
      const drinks = await prisma.drinkLog.findMany({ where });
      if (!drinks.length) return empty();
      const byDay = new Map<string, typeof drinks>();
      for (const d of drinks) byDay.set(d.date, [...(byDay.get(d.date) ?? []), d]);
      const daily = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, ds]) => ({ date, ml: summarizeDrinks(ds, 0).hydrationMl }));
      const avg = daily.reduce((a, d) => a + d.ml, 0) / daily.length;
      return {
        ...base,
        answer: daily.length === 1 ? `${range.label} ${n(daily[0].ml)} ml sıvı içtin.` : `${range.label} günde ortalama ${n(avg)} ml sıvı içtin (${daily.length} gün).`,
        rows: daily.map((d) => ({ label: formatDateTr(d.date), value: `${n(d.ml)} ml` })),
      };
    }
    case "cardio_total": {
      const logs = await prisma.cardioLog.findMany({ where, orderBy: { date: "asc" } });
      if (!logs.length) return empty();
      const minutes = logs.reduce((a, l) => a + l.durationMin, 0);
      const km = logs.reduce((a, l) => a + (l.distanceKm ?? 0), 0);
      return {
        ...base,
        answer: `${range.label}: ${logs.length} kardiyo · ${n(minutes)} dk · ${n(km)} km.`,
        rows: logs.map((l) => ({ label: formatDateTr(l.date), value: `${n(l.durationMin)} dk${l.distanceKm ? ` · ${n(l.distanceKm)} km` : ""}` })),
      };
    }
  }
}
