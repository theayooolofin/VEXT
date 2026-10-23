import { addDays, lagosDateTime, toLagosDate, type LagosDate } from './time';

export const FREE_DAYS = [1, 2, 3] as const;
export const TOTAL_DAYS = 14;
export const FIRST_PAID_DAY = 4;

export type EntitlementLike = {
  revokedAt: Date | null;
  expiresAt: Date;
  cohortStartDate: LagosDate;
};

export function isFreeDay(day: number) {
  return day >= 1 && day <= 3;
}

export function isEntitlementActive(e: EntitlementLike | null | undefined, now: Date): boolean {
  return Boolean(e && !e.revokedAt && e.expiresAt.getTime() > now.getTime());
}

/**
 * When a day opens for a student, or null if it needs payment.
 * Free days follow the signup date; paid days follow the cohort start date.
 */
export function unlockAt(
  day: number,
  studentCreatedAt: Date,
  entitlement: EntitlementLike | null | undefined,
  unlockTimeLocal: string,
  now: Date,
): Date | null {
  if (isFreeDay(day)) {
    if (day === 1) return studentCreatedAt;
    return lagosDateTime(addDays(toLagosDate(studentCreatedAt), day - 1), unlockTimeLocal);
  }
  if (!isEntitlementActive(entitlement, now)) return null;
  return lagosDateTime(addDays(entitlement!.cohortStartDate, day - FIRST_PAID_DAY), unlockTimeLocal);
}

export type DayState =
  | { state: 'done'; day: number; score: number | null; unlockedAt: Date }
  | { state: 'open'; day: number; unlockedAt: Date }
  | { state: 'locked'; day: number; unlocksAt: Date }
  | { state: 'needs_payment'; day: number }
  | { state: 'expired'; day: number }
  | { state: 'unavailable'; day: number; unlockedAt: Date };

export type DayStateInput = {
  studentCreatedAt: Date;
  entitlement: EntitlementLike | null;
  /** True when the student once paid but the entitlement has passed its expiry. */
  hadExpiredEntitlement?: boolean;
  unlockTimeLocal: string;
  now: Date;
  completed: Map<number, number | null>;
  isServable: (day: number) => boolean;
};

export function dayState(day: number, i: DayStateInput): DayState {
  const at = unlockAt(day, i.studentCreatedAt, i.entitlement, i.unlockTimeLocal, i.now);
  if (!at) return i.hadExpiredEntitlement ? { state: 'expired', day } : { state: 'needs_payment', day };
  if (at.getTime() > i.now.getTime()) return { state: 'locked', day, unlocksAt: at };
  if (i.completed.has(day)) return { state: 'done', day, score: i.completed.get(day) ?? null, unlockedAt: at };
  if (!i.isServable(day)) return { state: 'unavailable', day, unlockedAt: at };
  return { state: 'open', day, unlockedAt: at };
}

export function allDayStates(i: DayStateInput): DayState[] {
  return Array.from({ length: TOTAL_DAYS }, (_, k) => dayState(k + 1, i));
}

/** The next unlocked, not-done day, else the next locked one. */
export function nextAction(states: DayState[]): DayState | undefined {
  return states.find((s) => s.state === 'open') ?? states.find((s) => s.state === 'locked');
}
