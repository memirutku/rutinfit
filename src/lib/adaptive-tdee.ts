/**
 * F10: Adaptif TDEE. Son 21 günde (bugün hariç; yarım gün yanıltır) kayıtlı günlerin ortalama
 * alımı ve kilo eğiliminin eğiminden harcama tahmini:
 *   TDEE ≈ ortalama alım − (günlük kilo değişimi × 7.700 kcal)
 * Hedefe uyuma bakmaz; yalnız gerçekte yenen ve tartıda görülen kullanılır. Kayıtsız günler
 * ortalamaya girmez (bilinmiyor sayılır).
 */
import { addDaysToDateString } from "./date-utils";

const KCAL_PER_KG = 7700;
const WINDOW = 21;
const MIN_SPAN = 14;
const MIN_LOGGED_RATIO = 0.7;
const MIN_WEIGH_INS = 5;

export interface AdaptiveInput {
  today: string;
  intakes: Array<{ date: string; kcal: number }>;
  weights: Array<{ date: string; kg: number }>;
}

export type AdaptiveResult =
  | {
      ok: true;
      tdee: number;
      confidence: "high" | "medium";
      avgIntake: number;
      weightChangeKgPerWeek: number;
      loggedDays: number;
      windowDays: number;
      weighIns: number;
      from: string;
      to: string;
      /** Eğilim grafiği için pencere içindeki tartılar. */
      weights: Array<{ date: string; kg: number }>;
    }
  | { ok: false; reason: string };

const dayIndex = (from: string, date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** En küçük kareler eğimi (kg/gün). */
function slope(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  const num = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

export function estimateAdaptiveTdee({ today, intakes, weights }: AdaptiveInput): AdaptiveResult {
  const to = addDaysToDateString(today, -1);
  const from = addDaysToDateString(today, -WINDOW);
  const inWindow = (d: string) => d >= from && d <= to;

  // Aynı günün kayıtları toplanır.
  const byDay = new Map<string, number>();
  for (const i of intakes.filter((x) => inWindow(x.date))) byDay.set(i.date, (byDay.get(i.date) ?? 0) + i.kcal);
  const ws = weights.filter((w) => inWindow(w.date)).sort((a, b) => a.date.localeCompare(b.date));

  const dates = [...byDay.keys(), ...ws.map((w) => w.date)].sort();
  const span = dates.length ? dayIndex(dates[0], to) + 1 : 0;
  if (span < MIN_SPAN) return { ok: false, reason: `En az ${MIN_SPAN} günlük kayıt gerekir (şu an ${span} gün).` };
  const loggedDays = byDay.size;
  if (loggedDays / span < MIN_LOGGED_RATIO) {
    return { ok: false, reason: `Günlerin en az %70'inde öğün kaydı gerekir (${span} günün ${loggedDays}'inde kayıt var).` };
  }
  if (ws.length < MIN_WEIGH_INS) return { ok: false, reason: `En az ${MIN_WEIGH_INS} tartı gerekir (şu an ${ws.length}).` };

  const avgIntake = [...byDay.values()].reduce((a, b) => a + b, 0) / loggedDays;
  const kgPerDay = slope(ws.map((w) => ({ x: dayIndex(from, w.date), y: w.kg })));
  const tdee = Math.round((avgIntake - kgPerDay * KCAL_PER_KG) / 10) * 10;
  const confidence = span >= WINDOW && loggedDays / span >= 0.85 && ws.length >= 10 ? "high" : "medium";

  return {
    ok: true,
    tdee,
    confidence,
    avgIntake: Math.round(avgIntake),
    weightChangeKgPerWeek: Math.round(kgPerDay * 7 * 100) / 100,
    loggedDays,
    windowDays: span,
    weighIns: ws.length,
    from,
    to,
    weights: ws,
  };
}
