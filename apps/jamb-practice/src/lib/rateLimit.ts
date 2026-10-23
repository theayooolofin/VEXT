import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';

export type Limit = { name: string; max: number; windowSec: number };

// Postgres-backed fixed windows; no Redis needed (spec 4.4).
export const LIMITS = {
  // Generous per IP: many Nigerian mobile users share one carrier IP (CGNAT).
  signup: { name: 'signup', max: 30, windowSec: 3600 },
  recoverPhone: { name: 'recover-phone', max: 5, windowSec: 3600 },
  recoverIp: { name: 'recover-ip', max: 5, windowSec: 3600 },
  checkout: { name: 'checkout', max: 10, windowSec: 3600 },
  answer: { name: 'answer', max: 600, windowSec: 3600 },
  report: { name: 'report', max: 20, windowSec: 3600 },
  adminLogin: { name: 'admin-login', max: 10, windowSec: 900 },
  diagnostic: { name: 'diagnostic', max: 20, windowSec: 3600 },
  events: { name: 'events', max: 600, windowSec: 3600 },
  orderStatus: { name: 'order-status', max: 120, windowSec: 600 },
} satisfies Record<string, Limit>;

/** Counts one hit. Returns false when the caller is over the limit. */
export async function hit(limit: Limit, subject: string | null, now = new Date()): Promise<boolean> {
  if (!subject) return true;
  const db = await getDb();
  const windowMs = limit.windowSec * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const key = `${limit.name}:${subject}`;
  const rows = await db
    .insert(schema.rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [schema.rateLimits.key, schema.rateLimits.windowStart],
      set: { count: sql`${schema.rateLimits.count} + 1`, updatedAt: now },
    })
    .returning({ count: schema.rateLimits.count });
  return (rows[0]?.count ?? 1) <= limit.max;
}
