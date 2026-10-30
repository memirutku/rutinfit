/**
 * F50: Geçmiş üzerinde soru-cevap için soru yönlendirici. Model araç çağırmaz; soru kurallarla
 * sabit tipli sorgulardan birine eşlenir, sonuç koda hesaplatılır ve modele kesin veri olarak
 * verilir (4B–8B yerel modellerde de güvenilir çalışır).
 */
import { addDaysToDateString, startOfWeek } from "./date-utils";
import { foldTr } from "./food-search";

export const HISTORY_QUERY_TYPES = [
  "avg_calories",
  "avg_protein",
  "weight_change",
  "workouts_count",
  "best_lift",
  "top_foods",
  "water_avg",
  "cardio_total",
] as const;
export type HistoryQueryType = (typeof HISTORY_QUERY_TYPES)[number];

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const monthStart = (y: number, m: number) => {
  const d = new Date(Date.UTC(y, m - 1, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
};

export function parseRange(question: string, today: string): DateRange {
  const q = foldTr(question);
  const [y, m] = today.split("-").map(Number);
  let match = /son (\d+) gun/.exec(q);
  if (match) return { from: addDaysToDateString(today, -(Number(match[1]) - 1)), to: today, label: `Son ${match[1]} gün` };
  match = /son (\d+) hafta/.exec(q);
  if (match) return { from: addDaysToDateString(today, -(Number(match[1]) * 7 - 1)), to: today, label: `Son ${match[1]} hafta` };
  match = /son (\d+) ay/.exec(q);
  if (match) return { from: monthStart(y, m - (Number(match[1]) - 1)), to: today, label: `Son ${match[1]} ay` };
  if (/gecen hafta/.test(q)) {
    const from = addDaysToDateString(startOfWeek(today), -7);
    return { from, to: addDaysToDateString(from, 6), label: "Geçen hafta" };
  }
  if (/bu hafta/.test(q)) return { from: startOfWeek(today), to: today, label: "Bu hafta" };
  if (/gecen ay/.test(q)) {
    const from = monthStart(y, m - 1);
    return { from, to: addDaysToDateString(monthStart(y, m), -1), label: "Geçen ay" };
  }
  if (/bu ay/.test(q)) return { from: monthStart(y, m), to: today, label: "Bu ay" };
  if (/\bdun\b/.test(q)) {
    const d = addDaysToDateString(today, -1);
    return { from: d, to: d, label: "Dün" };
  }
  if (/\bbugun\b/.test(q)) return { from: today, to: today, label: "Bugün" };
  return { from: addDaysToDateString(today, -29), to: today, label: "Son 30 gün" };
}

/** Geçmişe dair bir soru mu? (öneri istekleri yönlendirilmez) */
const HISTORY_MARKER =
  /(kac|ne kadar|ortalama|nasildi|nasil gitti|toplam|en cok|rekor|en iyi|en agir|degisti|verdim|aldim|yaptim|ictim|kostum|yurudum|yedim|yemisim)/;

const RULES: Array<[HistoryQueryType, RegExp]> = [
  ["best_lift", /rekor|en iyi|en agir|1rm/],
  ["cardio_total", /\bkm\b|kosu|kostum|yuruyus|yurudum|kardiyo|bisiklet/],
  ["water_avg", /\bsu\b|su ic/],
  ["top_foods", /en cok (ne |neler )?(ye|yed|yemis)/],
  ["avg_protein", /protein/],
  ["avg_calories", /kalori|kcal/],
  ["weight_change", /kilo|kilom|tarti/],
  ["workouts_count", /antrenman|spor|idman/],
];

export interface HistoryQuery {
  type: HistoryQueryType;
  range: DateRange;
}

export function detectHistoryQuery(question: string, today: string): HistoryQuery | null {
  const q = foldTr(question);
  if (!HISTORY_MARKER.test(q)) return null;
  const rule = RULES.find(([, re]) => re.test(q));
  if (!rule) return null;
  const type = rule[0];
  const range = type === "best_lift" ? { from: "2000-01-01", to: today, label: "Tüm zamanlar" } : parseRange(question, today);
  return { type, range };
}
