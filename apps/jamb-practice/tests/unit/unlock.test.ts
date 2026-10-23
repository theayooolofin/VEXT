import { describe, expect, it } from 'vitest';
import { formatDay, formatLongDay, formatTime, formatUnlock, lagosDateTime, toLagosDate, LAGOS_TZ } from '@/lib/time';
import { allDayStates, dayState, unlockAt, type EntitlementLike } from '@/lib/unlock';

const lagos = (date: string, time: string) => lagosDateTime(date, time);
const NOW_FAR = new Date('2026-12-31T12:00:00Z');
const cohortEnt: EntitlementLike = {
  revokedAt: null,
  expiresAt: lagos('2027-02-14', '00:00'),
  cohortStartDate: '2026-11-16',
};

describe('Lagos time helpers', () => {
  it('matches Intl for Africa/Lagos across the year', () => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: LAGOS_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    for (let m = 0; m < 12; m++) {
      for (const h of [0, 12, 22, 23]) {
        const at = new Date(Date.UTC(2026, m, 15, h, 30));
        const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
        expect(toLagosDate(at)).toBe(`${parts.year}-${parts.month}-${parts.day}`);
      }
    }
  });

  it('converts Lagos 18:00 to 17:00 UTC', () => {
    expect(lagos('2026-11-16', '18:00').toISOString()).toBe('2026-11-16T17:00:00.000Z');
  });

  it('treats 23:30 Lagos as the same Lagos date even though UTC is earlier', () => {
    expect(toLagosDate(lagos('2026-11-07', '23:30'))).toBe('2026-11-07');
    expect(toLagosDate(new Date('2026-11-07T23:30:00Z'))).toBe('2026-11-08');
  });

  it('formats unlock labels as the copy deck shows them', () => {
    const at = lagos('2026-11-17', '18:00');
    expect(formatDay(at)).toBe('Tue 17 Nov');
    expect(formatTime(at)).toBe('6:00 pm');
    expect(formatUnlock(at)).toBe('Tue 17 Nov at 6:00 pm');
    expect(formatLongDay(lagos('2026-11-16', '18:00'))).toBe('Monday 16 November');
  });
});

describe('Appendix B: free days', () => {
  it('signup Sat 7 Nov 15:00: Day 1 now, Day 2 Sun 18:00, Day 3 Mon 18:00', () => {
    const signup = lagos('2026-11-07', '15:00');
    expect(unlockAt(1, signup, null, '18:00', NOW_FAR)).toEqual(signup);
    expect(unlockAt(2, signup, null, '18:00', NOW_FAR)).toEqual(lagos('2026-11-08', '18:00'));
    expect(unlockAt(3, signup, null, '18:00', NOW_FAR)).toEqual(lagos('2026-11-09', '18:00'));
  });

  it('signup at 23:30 on 7 Nov: Day 2 Sun 8 Nov 18:00, Day 3 Mon 9 Nov 18:00', () => {
    const signup = lagos('2026-11-07', '23:30');
    expect(unlockAt(1, signup, null, '18:00', NOW_FAR)).toEqual(signup);
    expect(unlockAt(2, signup, null, '18:00', NOW_FAR)).toEqual(lagos('2026-11-08', '18:00'));
    expect(unlockAt(3, signup, null, '18:00', NOW_FAR)).toEqual(lagos('2026-11-09', '18:00'));
  });

  it('signup at 23:59 Lagos keeps the Lagos calendar date', () => {
    const signup = lagos('2026-11-07', '23:59');
    expect(unlockAt(2, signup, null, '18:00', NOW_FAR)).toEqual(lagos('2026-11-08', '18:00'));
  });

  it('signup at 00:00 Lagos counts as the new day', () => {
    const signup = lagos('2026-11-08', '00:00');
    expect(unlockAt(2, signup, null, '18:00', NOW_FAR)).toEqual(lagos('2026-11-09', '18:00'));
  });

  it('signup exactly at 18:00: Day 2 is the next day at 18:00, not the same evening', () => {
    const signup = lagos('2026-11-07', '18:00');
    expect(unlockAt(2, signup, null, '18:00', NOW_FAR)).toEqual(lagos('2026-11-08', '18:00'));
  });
});

describe('Appendix B: paid days for the 16 November cohort', () => {
  const expected: [number, string][] = [
    [4, '2026-11-16'],
    [5, '2026-11-17'],
    [6, '2026-11-18'],
    [7, '2026-11-19'],
    [8, '2026-11-20'],
    [9, '2026-11-21'],
    [10, '2026-11-22'],
    [11, '2026-11-23'],
    [12, '2026-11-24'],
    [13, '2026-11-25'],
    [14, '2026-11-26'],
  ];
  it.each(expected)('Day %i unlocks %s at 18:00 Lagos', (day, date) => {
    const signup = lagos('2026-11-12', '10:00');
    expect(unlockAt(day, signup, cohortEnt, '18:00', NOW_FAR)).toEqual(lagos(date, '18:00'));
  });

  it('a cohort starting on a Sunday counts from that Sunday', () => {
    const ent = { ...cohortEnt, cohortStartDate: '2026-11-22' };
    expect(unlockAt(4, new Date(), ent, '18:00', NOW_FAR)).toEqual(lagos('2026-11-22', '18:00'));
    expect(unlockAt(5, new Date(), ent, '18:00', NOW_FAR)).toEqual(lagos('2026-11-23', '18:00'));
  });

  it('a change of unlock_time_local moves every unlock', () => {
    const signup = lagos('2026-11-07', '15:00');
    expect(unlockAt(2, signup, null, '07:30', NOW_FAR)).toEqual(lagos('2026-11-08', '07:30'));
    expect(unlockAt(4, signup, cohortEnt, '07:30', NOW_FAR)).toEqual(lagos('2026-11-16', '07:30'));
  });

  it('no entitlement: Days 4 to 14 need payment', () => {
    const states = allDayStates({
      studentCreatedAt: lagos('2026-11-07', '15:00'),
      entitlement: null,
      unlockTimeLocal: '18:00',
      now: lagos('2026-11-20', '12:00'),
      completed: new Map(),
      isServable: () => true,
    });
    expect(states.slice(0, 3).map((s) => s.state)).toEqual(['open', 'open', 'open']);
    expect(states.slice(3).every((s) => s.state === 'needs_payment')).toBe(true);
  });

  it('a refunded (revoked) entitlement needs payment again', () => {
    const revoked = { ...cohortEnt, revokedAt: lagos('2026-11-17', '09:00') };
    expect(unlockAt(4, new Date(), revoked, '18:00', NOW_FAR)).toBeNull();
  });

  it('an expired entitlement shows as expired', () => {
    const expired = { ...cohortEnt, expiresAt: lagos('2026-11-20', '00:00') };
    const s = dayState(5, {
      studentCreatedAt: lagos('2026-11-07', '15:00'),
      entitlement: null,
      hadExpiredEntitlement: true,
      unlockTimeLocal: '18:00',
      now: lagos('2026-11-21', '12:00'),
      completed: new Map(),
      isServable: () => true,
    });
    expect(unlockAt(5, new Date(), expired, '18:00', lagos('2026-11-21', '12:00'))).toBeNull();
    expect(s.state).toBe('expired');
  });
});

describe('day states', () => {
  const base = {
    studentCreatedAt: lagos('2026-11-12', '10:00'),
    entitlement: cohortEnt,
    unlockTimeLocal: '18:00',
    completed: new Map<number, number | null>([[1, 8]]),
    isServable: (d: number) => d !== 6,
  };

  it('a buyer on Thu 12 Nov sees Day 4 locked until Mon 16 Nov 18:00', () => {
    const s = dayState(4, { ...base, now: lagos('2026-11-12', '12:00') });
    expect(s).toEqual({ state: 'locked', day: 4, unlocksAt: lagos('2026-11-16', '18:00') });
  });

  it('opens exactly at the unlock instant, not a second before', () => {
    expect(dayState(4, { ...base, now: new Date(lagos('2026-11-16', '18:00').getTime() - 1000) }).state).toBe('locked');
    expect(dayState(4, { ...base, now: lagos('2026-11-16', '18:00') }).state).toBe('open');
  });

  it('done, open, unavailable and locked', () => {
    const now = lagos('2026-11-18', '19:00');
    const states = allDayStates({ ...base, now });
    expect(states[0]).toMatchObject({ state: 'done', score: 8 });
    expect(states[1]!.state).toBe('open');
    expect(states[5]!.state).toBe('unavailable');
    expect(states[6]).toMatchObject({ state: 'locked', unlocksAt: lagos('2026-11-19', '18:00') });
  });
});
