/**
 * B26: Ramazan'ın hangi günler olduğu, internetsiz.
 *
 * Bilinen yıllarda Diyanet takviminin ilk ve son oruç günleri kullanılır. Diğer yıllar
 * Ümmü'l-Kurâ (islamic-umalqura) takviminden hesaplanır; Diyanet ile bir gün fark olabilir
 * (örnek: 2026'da Ümmü'l-Kurâ 18 Şubat, Diyanet 19 Şubat). Ayın son günü iki takvimde de aynı
 * Şevval başlangıcından bulunur.
 */

/** Hicri yıl → Diyanet ilk ve son oruç günü. Kaynak: Diyanet imsakiyeleri (2024–2026). */
const DIYANET: Record<number, { start: string; end: string }> = {
  1445: { start: "2024-03-11", end: "2024-04-09" },
  1446: { start: "2025-03-01", end: "2025-03-29" },
  1447: { start: "2026-02-19", end: "2026-03-19" },
};

export interface RamadanInfo {
  inRamadan: boolean;
  /** Ramazan'ın kaçıncı günü (Ramazan dışında null). */
  day: number | null;
  /** İçinde bulunulan ya da sıradaki Ramazan'ın ilk ve son oruç günü. */
  start: string;
  end: string;
  /** Sıradaki Ramazan'a kalan gün (Ramazan içinde 0). */
  daysUntil: number;
}

const DAY_MS = 86_400_000;
const toUtc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => fromUtc(toUtc(iso) + n * DAY_MS);
const diffDays = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

let hijriFormat: Intl.DateTimeFormat | null | undefined;
function formatter(): Intl.DateTimeFormat | null {
  if (hijriFormat !== undefined) return hijriFormat;
  try {
    const f = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
    hijriFormat = f.resolvedOptions().calendar === "islamic-umalqura" ? f : null;
  } catch {
    hijriFormat = null;
  }
  return hijriFormat;
}

function hijri(iso: string): { year: number; month: number; day: number } | null {
  const f = formatter();
  if (!f) return null;
  const parts = f.formatToParts(new Date(toUtc(iso) + DAY_MS / 2));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const year = get("year");
  return { year, month: get("month"), day: get("day") };
}

/** Hicri ayın ilk gününü, tahmini bir tarihin çevresinde arar. */
function findMonthStart(year: number, month: number, guess: string): string | null {
  for (let offset = 0; offset <= 25; offset++) {
    for (const sign of offset ? [1, -1] : [1]) {
      const d = addDays(guess, sign * offset);
      const h = hijri(d);
      if (h && h.year === year && h.month === month && h.day === 1) return d;
    }
  }
  return null;
}

// Referans: 1 Ramazan 1447 (Ümmü'l-Kurâ) = 18.02.2026; hicri yıl ≈ 354,367 gün.
const REF_YEAR = 1447;
const REF_START = "2026-02-18";
const HIJRI_YEAR_DAYS = 354.367;

function period(hijriYear: number): { start: string; end: string } | null {
  if (DIYANET[hijriYear]) return DIYANET[hijriYear];
  const guess = addDays(REF_START, Math.round((hijriYear - REF_YEAR) * HIJRI_YEAR_DAYS));
  const start = findMonthStart(hijriYear, 9, guess);
  const shawwal = start ? findMonthStart(hijriYear, 10, addDays(start, 29)) : null;
  return start && shawwal ? { start, end: addDays(shawwal, -1) } : null;
}

/** Verilen günün (YYYY-AA-GG, Türkiye saati) Ramazan bilgisi. Takvim hesaplanamazsa null. */
export function ramadanInfo(date: string): RamadanInfo | null {
  const h = hijri(date);
  // Intl takvimi yoksa yalnız Diyanet tablosu kullanılır.
  const candidates = h ? [h.year, h.year + 1] : Object.keys(DIYANET).map(Number);
  for (const year of candidates) {
    const p = period(year);
    if (!p || date > p.end) continue;
    const inRamadan = date >= p.start;
    return {
      inRamadan,
      day: inRamadan ? diffDays(p.start, date) + 1 : null,
      start: p.start,
      end: p.end,
      daysUntil: inRamadan ? 0 : diffDays(date, p.start),
    };
  }
  return null;
}
