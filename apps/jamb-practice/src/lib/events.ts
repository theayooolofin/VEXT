import 'server-only';
import { getDb, schema } from '@/db';
import type { Tx } from '@/db';
import type { FirstTouch } from '@/db/schema';

// First-party analytics only (spec section 11). Names are fixed.
export const EVENT_NAMES = [
  'page_view',
  'hero_question_shown',
  'hero_question_answered',
  'diagnostic_started',
  'diagnostic_completed',
  'signup_started',
  'signup_completed',
  'signup_failed',
  'lesson_started',
  'question_answered',
  'lesson_completed',
  'locked_day_viewed',
  'checkout_started',
  'payment_succeeded',
  'payment_failed',
  'push_prompt_shown',
  'push_granted',
  'push_denied',
  'ios_banner_shown',
  'question_reported',
  'referral_link_copied',
  'referral_landing',
  'offline_queue_flushed',
  'error_shown',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

// Events the browser may send. The rest are recorded by the server only, so
// funnel stages like "paid" cannot be faked from a browser.
export const CLIENT_EVENTS: ReadonlySet<EventName> = new Set<EventName>([
  'page_view',
  'hero_question_shown',
  'hero_question_answered',
  'diagnostic_started',
  'signup_started',
  'lesson_started',
  'locked_day_viewed',
  'push_prompt_shown',
  'push_granted',
  'push_denied',
  'ios_banner_shown',
  'referral_link_copied',
  'offline_queue_flushed',
  'error_shown',
]);

export type EventContext = {
  anonId?: string | null;
  studentId?: string | null;
  attribution?: FirstTouch | null;
  userAgentClass?: string | null;
  path?: string | null;
};

export async function recordEvent(
  name: EventName,
  props: Record<string, unknown>,
  ctx: EventContext,
  tx?: Tx,
) {
  const db = tx ?? (await getDb());
  await db.insert(schema.events).values({
    name,
    props,
    anonId: ctx.anonId ?? null,
    studentId: ctx.studentId ?? null,
    path: ctx.path ?? null,
    utmSource: ctx.attribution?.utm_source ?? null,
    utmMedium: ctx.attribution?.utm_medium ?? null,
    utmCampaign: ctx.attribution?.utm_campaign ?? null,
    userAgentClass: ctx.userAgentClass ?? null,
  });
}

/** Server-side errors: structured, no personal data. */
export function logServer(level: 'info' | 'warn' | 'error', msg: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...data });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
