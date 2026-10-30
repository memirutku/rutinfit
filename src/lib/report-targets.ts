/**
 * B43: Diyetisyen raporunda ortalamaların hedeften sapması. Saf işlevler: hem sunucu (rapor, Excel)
 * hem ekran (özet kartları) aynı eşikleri ve metni kullanır.
 */
import { formatNumberTr } from "./format";

/** ok: hedefe uygun · warn: dikkat · off: hedeften belirgin sapma. */
export type DeviationStatus = "ok" | "warn" | "off";
export type TargetMetric = "kcal" | "protein" | "carbs" | "fat";

export interface TargetComparison {
  avg: number;
  target: number;
  diff: number;
  /** Hedefe göre yüzde fark (tam sayı; negatif = altında). */
  diffPct: number;
  status: DeviationStatus;
}

/**
 * Ortalama ile hedefi karşılaştırır. Kalori: hedefin %90'ı ile tavan arası uygun, ±%20'ye kadar dikkat.
 * Protein: hedefin %90'ı ve üstü uygun (fazlası sapma sayılmaz), %75'e kadar dikkat.
 * Karbonhidrat ve yağ: ±%15 uygun, ±%30'a kadar dikkat. Ortalama ya da hedef yoksa null.
 */
export function compareToTarget(metric: TargetMetric, average: number | null, target: number | null, ceiling?: number | null): TargetComparison | null {
  if (average === null || target === null || !(target > 0)) return null;
  const ratio = average / target;
  let status: DeviationStatus;
  if (metric === "kcal") {
    const top = ceiling && ceiling > target ? ceiling : target * 1.1;
    status = ratio >= 0.9 && average <= top ? "ok" : ratio >= 0.8 && ratio <= 1.2 ? "warn" : "off";
  } else if (metric === "protein") {
    status = ratio >= 0.9 ? "ok" : ratio >= 0.75 ? "warn" : "off";
  } else {
    const off = Math.abs(ratio - 1);
    status = off <= 0.15 ? "ok" : off <= 0.3 ? "warn" : "off";
  }
  return { avg: average, target, diff: Math.round(average - target), diffPct: Math.round((ratio - 1) * 100), status };
}

/** "−242 kcal (hedefin %16 altında)" biçiminde sapma metni (Excel ve ekran). */
export function deviationText(c: TargetComparison, unit: string): string {
  const where = c.diffPct === 0 ? "hedefte" : `hedefin %${Math.abs(c.diffPct)} ${c.diffPct < 0 ? "altında" : "üstünde"}`;
  return `${c.diff > 0 ? "+" : ""}${formatNumberTr(c.diff)} ${unit} (${where})`;
}
