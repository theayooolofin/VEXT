// Africa/Lagos is WAT, UTC+1 all year with no daylight saving. Timestamps are
// stored in UTC; schedules are computed on Lagos calendar dates. The fixed
// offset is cross-checked against Intl in tests/unit/time.test.ts.
export const LAGOS_TZ = 'Africa/Lagos';
const OFFSET_MS = 60 * 60 * 1000;

/** A calendar date as YYYY-MM-DD. */
export type LagosDate = string;

export function toLagosDate(at: Date): LagosDate {
  return new Date(at.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: LagosDate, days: number): LagosDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Parses "HH:MM" and returns the UTC instant of that Lagos wall-clock time on a date. */
export function lagosDateTime(date: LagosDate, hhmm: string): Date {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw new Error(`Invalid time of day: ${hhmm}`);
  const wall = Date.parse(`${date}T${m[1]}:${m[2]}:00Z`);
  return new Date(wall - OFFSET_MS);
}

/** Lagos wall-clock hour (0-23) of an instant. */
export function lagosHour(at: Date): number {
  return new Date(at.getTime() + OFFSET_MS).getUTCHours();
}

const dayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: LAGOS_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const longDayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: LAGOS_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: LAGOS_TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "6:00 pm" */
export function formatTime(at: Date): string {
  return timeFmt.format(at).replace(/\s?([ap])\.?m\.?/i, ' $1m').toLowerCase();
}

/** "Tue 17 Nov" */
export function formatDay(at: Date): string {
  return dayFmt.format(at).replace(',', '');
}

/** "Monday 16 November" */
export function formatLongDay(at: Date): string {
  return longDayFmt.format(at).replace(',', '');
}

/** "Tue 17 Nov at 6:00 pm" */
export function formatUnlock(at: Date): string {
  return `${formatDay(at)} at ${formatTime(at)}`;
}

/** Parses "YYYY-MM-DDTHH:MM" as Lagos wall-clock time (admin forms). */
export function parseLagosLocal(value: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (!m) return null;
  try {
    return lagosDateTime(m[1]!, m[2]!);
  } catch {
    return null;
  }
}

/** Formats an instant as "YYYY-MM-DDTHH:MM" in Lagos time (for datetime-local inputs). */
export function toLagosLocalInput(at: Date): string {
  return new Date(at.getTime() + OFFSET_MS).toISOString().slice(0, 16);
}
