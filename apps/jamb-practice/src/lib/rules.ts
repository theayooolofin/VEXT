// Pure business rules for pricing and enrolment, kept apart from the database
// so they can be unit tested directly.
import type { Settings } from './settings';

export type CohortWindow = {
  id: string;
  enrollmentOpensAt: Date;
  enrollmentClosesAt: Date;
  active: boolean;
  startDate: string;
};

/**
 * Founding price applies before the deadline while fewer than founding_cap
 * core orders are paid. Two checkouts racing at the exact cap can both get the
 * founding price; that small overshoot is accepted (docs/ARCHITECTURE.md).
 */
export function resolvePriceKobo(
  s: Pick<Settings, 'founding_cap' | 'founding_deadline' | 'founding_price_kobo' | 'standard_price_kobo'>,
  paidCoreOrders: number,
  now: Date,
): { priceKobo: number; founding: boolean } {
  const founding = now.getTime() < Date.parse(s.founding_deadline) && paidCoreOrders < s.founding_cap;
  return { priceKobo: founding ? s.founding_price_kobo : s.standard_price_kobo, founding };
}

/** Enrolment is open from opens_at (inclusive) to closes_at (inclusive). */
export function isEnrollmentOpen(c: CohortWindow, now: Date): boolean {
  const t = now.getTime();
  return c.active && t >= c.enrollmentOpensAt.getTime() && t <= c.enrollmentClosesAt.getTime();
}

/** The open cohort that starts soonest, if any. */
export function openCohort<T extends CohortWindow>(cohorts: T[], now: Date): T | null {
  return (
    cohorts
      .filter((c) => isEnrollmentOpen(c, now))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
  );
}

export function foundingPlacesLeft(
  s: Pick<Settings, 'founding_cap' | 'founding_deadline'>,
  paidCoreOrders: number,
  now: Date,
): number {
  if (now.getTime() >= Date.parse(s.founding_deadline)) return 0;
  return Math.max(0, s.founding_cap - paidCoreOrders);
}

export function nairaFromKobo(kobo: number): string {
  const naira = kobo / 100;
  return `₦${naira.toLocaleString('en-NG', { maximumFractionDigits: naira % 1 ? 2 : 0 })}`;
}

export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** wa.me link: digits only, with country code. */
export function whatsappLink(digits: string, text?: string): string {
  const clean = digits.replace(/\D/g, '');
  return `https://wa.me/${clean}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
