import { describe, it, expect } from 'vitest';
import {
  getLocalDateString,
  getLocalTimeString,
  addDaysToDateString,
  DEFAULT_TIMEZONE,
} from '../src/lib/date-utils';

describe('Date Utils (Europe/Istanbul Timezone)', () => {
  it('correctly maps 22:30 UTC to the next day in Europe/Istanbul (UTC+3)', () => {
    // 2026-10-18 22:30:00 UTC is 2026-10-19 01:30:00 in Turkey (+3)
    const lateUtc = new Date('2026-10-18T22:30:00.000Z');
    
    // Previous flawed behavior: lateUtc.toISOString().split('T')[0] === '2026-10-18'
    expect(lateUtc.toISOString().split('T')[0]).toBe('2026-10-18');

    // Correct local behavior in Europe/Istanbul:
    const localDate = getLocalDateString(lateUtc, DEFAULT_TIMEZONE);
    expect(localDate).toBe('2026-10-19');

    const localTime = getLocalTimeString(lateUtc, DEFAULT_TIMEZONE);
    expect(localTime).toBe('01:30');
  });

  it('correctly maps daytime UTC to Europe/Istanbul date', () => {
    const noonUtc = new Date('2026-10-18T12:00:00.000Z');
    expect(getLocalDateString(noonUtc)).toBe('2026-10-18');
    expect(getLocalTimeString(noonUtc)).toBe('15:00');
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
