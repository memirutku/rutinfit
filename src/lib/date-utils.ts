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
export function addDaysToDateString(
  dateStr: string,
  days: number,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);
  return getLocalDateString(date, timeZone);
}
