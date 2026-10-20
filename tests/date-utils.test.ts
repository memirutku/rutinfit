import { describe, it, expect } from 'vitest';
import {
  getLocalDateString,
  getLocalTimeString,
  addDaysToDateString,
  appTimeZone,
  startOfWeek,
  isDateString,
} from '../src/lib/date-utils';
import { afterEach, vi } from 'vitest';

const IST = 'Europe/Istanbul';
afterEach(() => vi.unstubAllEnvs());

describe('Date Utils (Europe/Istanbul Timezone)', () => {
  it('correctly maps 22:30 UTC to the next day in Europe/Istanbul (UTC+3)', () => {
    // 2026-10-18 22:30:00 UTC is 2026-10-19 01:30:00 in Turkey (+3)
    const lateUtc = new Date('2026-10-18T22:30:00.000Z');
    
    // Previous flawed behavior: lateUtc.toISOString().split('T')[0] === '2026-10-18'
    expect(lateUtc.toISOString().split('T')[0]).toBe('2026-10-18');

    // Correct local behavior in Europe/Istanbul:
    const localDate = getLocalDateString(lateUtc, IST);
    expect(localDate).toBe('2026-10-19');

    const localTime = getLocalTimeString(lateUtc, IST);
    expect(localTime).toBe('01:30');
  });

  it('correctly maps daytime UTC to Europe/Istanbul date', () => {
    const noonUtc = new Date('2026-10-18T12:00:00.000Z');
    expect(getLocalDateString(noonUtc, IST)).toBe('2026-10-18');
    expect(getLocalTimeString(noonUtc, IST)).toBe('15:00');
  });

  it('handles invalid dates gracefully by falling back to today', () => {
    const invalid = getLocalDateString('not-a-valid-date');
    expect(invalid).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('adds and subtracts days correctly', () => {
    expect(addDaysToDateString('2026-10-18', 1)).toBe('2026-10-19');
    expect(addDaysToDateString('2026-10-18', -1)).toBe('2026-10-17');
    expect(addDaysToDateString('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('appTimeZone', () => {
  it('RUTINFIT_TIMEZONE verilirse onu kullanır', () => {
    vi.stubEnv('RUTINFIT_TIMEZONE', 'Asia/Tokyo');
    expect(appTimeZone()).toBe('Asia/Tokyo');
    expect(getLocalDateString(new Date('2026-10-18T16:00:00Z'))).toBe('2026-10-19');
  });

  it('geçersiz değerde sistem saat dilimine, o da yoksa Europe/Istanbul\'a düşer', () => {
    vi.stubEnv('RUTINFIT_TIMEZONE', 'Mars/Olympus');
    const tz = appTimeZone();
    expect(() => new Intl.DateTimeFormat('en', { timeZone: tz })).not.toThrow();
  });
});

describe('takvim yardımcıları', () => {
  it('UTC+14 bölgesinde bile gün eklemek tarihi kaydırmaz', () => {
    vi.stubEnv('RUTINFIT_TIMEZONE', 'Pacific/Kiritimati');
    expect(addDaysToDateString('2026-10-18', 1)).toBe('2026-10-19');
  });

  it('startOfWeek Pazartesi döner', () => {
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19'); // Pazartesi
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19'); // Pazar
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26'); // ay geçişi
  });

  it('isDateString takvimde olmayan günü reddeder', () => {
    expect(isDateString('2026-02-28')).toBe(true);
    expect(isDateString('2026-02-30')).toBe(false);
    expect(isDateString('18.10.2026')).toBe(false);
  });
});
