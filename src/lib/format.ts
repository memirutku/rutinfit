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

/**
 * Türkçe ve İngilizce yazılmış ondalık sayıyı okur: "62,5", "62.5", "1.234,5", "1 500".
 * İki ayraç birlikteyse sondaki ondalık, diğeri binlik sayılır. Geçersiz ya da boş girişte null.
 */
export function parseDecimalTr(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = (raw ?? "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(".") && s.includes(",")) {
    const decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    s = s.split(thousands).join("").replace(decimal, ".");
  } else {
    s = s.replace(",", ".");
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "2026-10-30" → "30.10.2026" (kısa: "30.10"). Tarih olmayan metin olduğu gibi döner. */
export function formatDateTr(iso: string | null | undefined, opts: { short?: boolean } = {}): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso ?? "";
  return opts.short ? `${m[3]}.${m[2]}` : `${m[3]}.${m[2]}.${m[1]}`;
}

/** Türkçe ondalıklı sayı, en çok `digits` ondalıkla: formatDecimalTr(0.856, 2) → "0,86". */
export function formatDecimalTr(value: number, digits: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits }).format(value);
}
