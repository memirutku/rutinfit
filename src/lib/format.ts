import { normalizeUnit } from "./units";

const numberFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

/** Türkçe ondalık ayracıyla sayı: 1.5 → "1,5", 1500 → "1.500". */
export function formatNumberTr(value: number): string {
  return numberFormat.format(value);
}

/** Miktarı okunur birimle gösterir: 1500 g → "1,5 kg", 750 ml → "750 ml", 3 adet → "3 adet". */
export function formatAmount(amount: number, unit: string = "g"): string {
  const u = normalizeUnit(unit);
  if (u === "g" && Math.abs(amount) >= 1000) return `${formatNumberTr(amount / 1000)} kg`;
  if (u === "ml" && Math.abs(amount) >= 1000) return `${formatNumberTr(amount / 1000)} l`;
  return `${formatNumberTr(amount)} ${u}`;
}

/** Kiler ± düğmelerinin birime uygun adımı. */
export function pantryStep(unit: string): number {
  const u = normalizeUnit(unit);
  if (u === "g" || u === "ml") return 50;
  if (u === "kg" || u === "l") return 0.1;
  return 1;
}
