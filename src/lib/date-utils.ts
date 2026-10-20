/**
 * RutinFit Merkezi Tarih ve Zaman Yardımcı Servisi
 *
 * UTC tarih anahtarlarının gece 00:00 - 03:00 (Türkiye saati) arasında
 * bir önceki güne kaymasını önlemek için standart 'Europe/Istanbul'
 * veya kullanıcı profili zaman dilimini esas alır.
 */

export const DEFAULT_TIMEZONE = 'Europe/Istanbul';

/**
 * Verilen tarihi veya anı 'YYYY-MM-DD' formatında yerel tarih dizesine dönüştürür.
 */
export function getLocalDateString(
  input?: Date | string | number | null,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const date = input ? new Date(input) : new Date();

  // Geçersiz tarih kontrolü
  if (isNaN(date.getTime())) {
    return new Date().toLocaleDateString('sv-SE', { timeZone });
  }

  // 'sv-SE' yerel ayarı standart ISO YYYY-MM-DD çıktısı üretir
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Verilen tarihi veya anı 'HH:mm' formatında yerel saat dizesine dönüştürür.
 */
export function getLocalTimeString(
  input?: Date | string | number | null,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const date = input ? new Date(input) : new Date();

  if (isNaN(date.getTime())) {
    return '12:00';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Belirtilen gün sayısı kadar ileri/geri gidip YYYY-MM-DD döner.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  // Saf takvim aritmetiği: saat dilimine dönüştürmek UTC+12..+14'te bir gün kaydırırdı.
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' biçiminde ve takvimde var olan bir tarih mi? (2026-02-30 → false) */
export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Verilen günün içinde bulunduğu haftanın Pazartesi tarihi (ISO hafta). */
export function startOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Pazar
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDaysToDateString(dateStr, offset);
}
