import 'server-only';
import { and, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import webpush from 'web-push';
import { backupPglite, getDb, schema } from '@/db';
import { getAccess } from './access';
import { env } from './env';
import { logServer } from './events';
import { settleOrder } from './payments/settle';
import type { Settings } from './settings';
import { lagosDateTime, lagosHour, toLagosDate } from './time';
import { dayState } from './unlock';
import { servableLesson } from './content';

// ---------- Push sending ----------

export type PushSender = (
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
) => Promise<{ statusCode: number }>;

const g = globalThis as unknown as { __jpPushSender?: PushSender };

export function pushConfigured(): boolean {
  const e = env();
  return Boolean(e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY && e.VAPID_SUBJECT);
}

function defaultSender(): PushSender {
  const e = env();
  webpush.setVapidDetails(e.VAPID_SUBJECT!, e.VAPID_PUBLIC_KEY!, e.VAPID_PRIVATE_KEY!);
  return async (sub, payload) => {
    try {
      const r = await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 6 * 3600, urgency: 'normal' },
      );
      return { statusCode: r.statusCode };
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode ?? 0;
      return { statusCode };
    }
  };
}

export function setPushSenderForTests(s: PushSender | undefined) {
  g.__jpPushSender = s;
}

/** No pushes between 21:00 and 06:00 Lagos time. */
export function inQuietHours(now: Date): boolean {
  const h = lagosHour(now);
  return h >= 21 || h < 6;
}

// ---------- Reminders ----------

export async function runReminders(settings: Settings, now = new Date()) {
  const result = { considered: 0, sent: 0, skipped: 0, revoked: 0, failed: 0, quiet: false };
  if (inQuietHours(now)) return { ...result, quiet: true };
  if (!g.__jpPushSender && !pushConfigured()) return result;
  const send = g.__jpPushSender ?? defaultSender();
  const db = await getDb();

  const subs = await db
    .select({ sub: schema.pushSubscriptions, student: schema.students })
    .from(schema.pushSubscriptions)
    .innerJoin(schema.students, eq(schema.students.id, schema.pushSubscriptions.studentId))
    .where(and(isNull(schema.pushSubscriptions.revokedAt), isNull(schema.students.deletedAt)));

  const byStudent = new Map<string, { student: typeof schema.students.$inferSelect; subs: (typeof schema.pushSubscriptions.$inferSelect)[] }>();
  for (const { sub, student } of subs) {
    const entry = byStudent.get(student.id) ?? { student, subs: [] };
    entry.subs.push(sub);
    byStudent.set(student.id, entry);
  }

  const today = toLagosDate(now);
  const dayStart = lagosDateTime(today, '00:00');
  const basePath = env().BASE_PATH;

  for (const { student, subs: studentSubs } of byStudent.values()) {
    result.considered++;
    // At most one push per student per Lagos day.
    const sentToday = await db
      .select({ id: schema.reminderLog.id })
      .from(schema.reminderLog)
      .where(
        and(
          eq(schema.reminderLog.studentId, student.id),
          eq(schema.reminderLog.channel, 'push'),
          gte(schema.reminderLog.sentAt, dayStart),
        ),
      )
      .limit(1);
    if (sentToday.length) {
      result.skipped++;
      continue;
    }
    const access = await getAccess(student.id, now);
    const done = await db
      .select({ day: schema.lessonProgress.day })
      .from(schema.lessonProgress)
      .where(and(eq(schema.lessonProgress.studentId, student.id), sql`${schema.lessonProgress.completedAt} is not null`));
    const completed = new Map(done.map((d) => [d.day, null]));
    // The day that opened today (Lagos), not done yet.
    let target: number | null = null;
    for (let day = 2; day <= 14; day++) {
      const s = dayState(day, {
        studentCreatedAt: student.createdAt,
        entitlement: access.active,
        unlockTimeLocal: settings.unlock_time_local,
        now,
        completed,
        isServable: (d) => Boolean(servableLesson(d)),
      });
      if (s.state === 'open' && toLagosDate(s.unlockedAt) === today) {
        target = day;
        break;
      }
    }
    if (!target) {
      result.skipped++;
      continue;
    }
    // Claim the reminder first; the unique key stops a second run sending again.
    const claimed = await db
      .insert(schema.reminderLog)
      .values({ studentId: student.id, day: target, kind: 'unlock', channel: 'push', sentAt: now, result: 'sending' })
      .onConflictDoNothing()
      .returning({ id: schema.reminderLog.id });
    if (!claimed.length) {
      result.skipped++;
      continue;
    }
    const payload = JSON.stringify({
      title: `Day ${target} is ready`,
      body: '10 minutes today.',
      url: `${basePath}/learn/day/${target}`,
    });
    let delivered = false;
    for (const sub of studentSubs) {
      const { statusCode } = await send(sub, payload);
      if (statusCode >= 200 && statusCode < 300) {
        delivered = true;
        await db
          .update(schema.pushSubscriptions)
          .set({ lastSuccessAt: now, failedCount: 0 })
          .where(eq(schema.pushSubscriptions.id, sub.id));
      } else {
        const gone = statusCode === 404 || statusCode === 410;
        const failedCount = sub.failedCount + 1;
        const revoke = gone || failedCount >= 5;
        if (revoke) result.revoked++;
        await db
          .update(schema.pushSubscriptions)
          .set({ failedCount, revokedAt: revoke ? now : null })
          .where(eq(schema.pushSubscriptions.id, sub.id));
      }
    }
    await db
      .update(schema.reminderLog)
      .set({ result: delivered ? 'sent' : 'failed' })
      .where(eq(schema.reminderLog.id, claimed[0]!.id));
    if (delivered) result.sent++;
    else result.failed++;
  }
  logServer('info', 'reminders run', result);
  return result;
}

// ---------- Housekeeping ----------

const MIN = 60_000;

export async function runHousekeeping(now = new Date()) {
  const db = await getDb();
  const out = { reverified: 0, settled: 0, abandoned: 0, prunedRateLimits: 0, prunedEvents: 0, prunedSessions: 0 };

  // Re-verify pending orders older than 30 minutes; abandon those unpaid after 24 hours.
  const stale = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        inArray(schema.orders.status, ['pending', 'failed']),
        lt(schema.orders.createdAt, new Date(now.getTime() - 30 * MIN)),
        gte(schema.orders.createdAt, new Date(now.getTime() - 7 * 24 * 60 * MIN)),
      ),
    );
  for (const o of stale) {
    out.reverified++;
    try {
      const r = await settleOrder(o.reference, { source: 'housekeeping', now });
      if (r.outcome === 'paid') out.settled++;
      if (
        r.outcome === 'pending' &&
        o.status === 'pending' &&
        o.createdAt.getTime() < now.getTime() - 24 * 60 * MIN
      ) {
        await db
          .update(schema.orders)
          .set({ status: 'abandoned' })
          .where(and(eq(schema.orders.id, o.id), eq(schema.orders.status, 'pending')));
        out.abandoned++;
      }
    } catch (e) {
      logServer('warn', 'housekeeping verify failed', { reference: o.reference, message: (e as Error).message });
    }
  }

  const rl = await db
    .delete(schema.rateLimits)
    .where(lt(schema.rateLimits.windowStart, new Date(now.getTime() - 24 * 60 * MIN)))
    .returning({ k: schema.rateLimits.key });
  out.prunedRateLimits = rl.length;

  const yearAgo = new Date(now);
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
  const ev = await db.delete(schema.events).where(lt(schema.events.occurredAt, yearAgo)).returning({ id: schema.events.id });
  out.prunedEvents = ev.length;

  const ss = await db
    .delete(schema.sessions)
    .where(
      or(
        lt(schema.sessions.expiresAt, now),
        lt(schema.sessions.revokedAt, new Date(now.getTime() - 7 * 24 * 60 * MIN)),
      ),
    )
    .returning({ id: schema.sessions.id });
  out.prunedSessions = ss.length;

  let backup: string | null = null;
  try {
    backup = await backupPglite(now);
  } catch (e) {
    logServer('error', 'database backup failed', { message: (e as Error).message });
  }

  logServer('info', 'housekeeping run', { ...out, backup });
  return { ...out, backup };
}
