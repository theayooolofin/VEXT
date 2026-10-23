import 'server-only';
import { and, count, countDistinct, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, sql, sum, type SQL } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { CORE_SKU } from './access';
import { allowUnreviewed, getContent } from './content';
import { isServable } from './contentStore';
import type { Settings } from './settings';
import { addDays, lagosDateTime, toLagosDate } from './time';
import { unlockAt } from './unlock';

export type Range = { from: Date; to: Date };
export type FunnelFilter = Range & { source?: string; cohortId?: string };

const e = schema.events;

function eventSourceFilter(source?: string): SQL | undefined {
  if (!source) return undefined;
  return source === 'direct' ? isNull(e.utmSource) : eq(e.utmSource, source);
}

function studentSourceFilter(source?: string): SQL | undefined {
  if (!source) return undefined;
  const col = sql`${schema.students.firstTouch}->>'utm_source'`;
  return source === 'direct' ? sql`(${col}) is null` : sql`(${col}) = ${source}`;
}

async function distinctAnon(name: string, f: FunnelFilter, extra?: SQL) {
  const db = await getDb();
  const [row] = await db
    .select({ n: countDistinct(e.anonId) })
    .from(e)
    .where(and(eq(e.name, name), gte(e.occurredAt, f.from), lt(e.occurredAt, f.to), eventSourceFilter(f.source), extra));
  return row?.n ?? 0;
}

export async function funnel(f: FunnelFilter) {
  const db = await getDb();
  const landing = await distinctAnon('page_view', f, eq(e.path, '/'));
  const hero = await distinctAnon('hero_question_answered', f);
  const diagStarted = await distinctAnon('diagnostic_started', f);
  const diagDone = await distinctAnon('diagnostic_completed', f);

  const studentWhere = and(
    gte(schema.students.createdAt, f.from),
    lt(schema.students.createdAt, f.to),
    studentSourceFilter(f.source),
  );
  const [signed] = await db.select({ n: count() }).from(schema.students).where(studentWhere);
  const [day1] = await db
    .select({ n: countDistinct(schema.lessonProgress.studentId) })
    .from(schema.lessonProgress)
    .innerJoin(schema.students, eq(schema.students.id, schema.lessonProgress.studentId))
    .where(and(studentWhere, eq(schema.lessonProgress.day, 1), isNotNull(schema.lessonProgress.completedAt)));

  const orderWhere = (paid: boolean) =>
    and(
      gte(schema.orders.createdAt, f.from),
      lt(schema.orders.createdAt, f.to),
      eq(schema.orders.isTest, false),
      f.source ? eq(schema.orders.channel, f.source) : undefined,
      f.cohortId ? eq(schema.orders.cohortId, f.cohortId) : undefined,
      paid ? eq(schema.orders.status, 'paid') : undefined,
    );
  const [checkout] = await db.select({ n: countDistinct(schema.orders.studentId) }).from(schema.orders).where(orderWhere(false));
  const [paid] = await db.select({ n: countDistinct(schema.orders.studentId) }).from(schema.orders).where(orderWhere(true));

  const stages = [
    { label: 'Landing visitors', n: landing },
    { label: 'Answered the hero question', n: hero },
    { label: 'Started the diagnostic', n: diagStarted },
    { label: 'Completed the diagnostic', n: diagDone },
    { label: 'Signed up', n: signed?.n ?? 0 },
    { label: 'Completed free Day 1', n: day1?.n ?? 0 },
    { label: 'Started checkout', n: checkout?.n ?? 0 },
    { label: 'Paid', n: paid?.n ?? 0 },
  ];
  return stages.map((s, i) => ({
    ...s,
    pctOfPrev: i === 0 ? null : stages[i - 1]!.n ? Math.round((s.n / stages[i - 1]!.n) * 1000) / 10 : null,
  }));
}

export async function channels(r: Range) {
  const db = await getDb();
  const visitors = await db
    .select({ source: e.utmSource, n: countDistinct(e.anonId) })
    .from(e)
    .where(and(eq(e.name, 'page_view'), eq(e.path, '/'), gte(e.occurredAt, r.from), lt(e.occurredAt, r.to)))
    .groupBy(e.utmSource);
  const src = sql<string | null>`${schema.students.firstTouch}->>'utm_source'`;
  const signups = await db
    .select({ source: src, n: count() })
    .from(schema.students)
    .where(and(gte(schema.students.createdAt, r.from), lt(schema.students.createdAt, r.to)))
    .groupBy(src);
  const paid = await db
    .select({ source: schema.orders.channel, n: countDistinct(schema.orders.studentId) })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.status, 'paid'),
        eq(schema.orders.isTest, false),
        gte(schema.orders.createdAt, r.from),
        lt(schema.orders.createdAt, r.to),
      ),
    )
    .groupBy(schema.orders.channel);
  const spend = await db
    .select({ source: schema.adSpend.channel, kobo: sum(schema.adSpend.amountKobo) })
    .from(schema.adSpend)
    .where(and(gte(schema.adSpend.date, toLagosDate(r.from)), lt(schema.adSpend.date, toLagosDate(r.to))))
    .groupBy(schema.adSpend.channel);

  const rows = new Map<string, { source: string; visitors: number; signups: number; paid: number; spendKobo: number | null }>();
  const get = (s: string | null) => {
    const key = s || 'direct';
    let row = rows.get(key);
    if (!row) rows.set(key, (row = { source: key, visitors: 0, signups: 0, paid: 0, spendKobo: null }));
    return row;
  };
  for (const v of visitors) get(v.source).visitors += v.n;
  for (const v of signups) get(v.source).signups += v.n;
  for (const v of paid) get(v.source).paid += v.n;
  for (const v of spend) get(v.source).spendKobo = (get(v.source).spendKobo ?? 0) + Number(v.kobo ?? 0);
  return [...rows.values()]
    .map((r) => ({ ...r, cacKobo: r.spendKobo != null && r.paid > 0 ? Math.round(r.spendKobo / r.paid) : null }))
    .sort((a, b) => b.paid - a.paid || b.visitors - a.visitors);
}

export type GateStatus = 'waiting' | 'on track' | 'passed' | 'failed';

export async function gates(settings: Settings, now = new Date()) {
  const db = await getDb();

  // Gate 1: interview numbers entered by hand.
  const done = settings.gate1_interviews_done;
  const confirmed = settings.gate1_confirmed;
  const gate1: GateStatus =
    done < 15 ? (confirmed >= 10 ? 'passed' : 'waiting') : confirmed / done >= 10 / 15 ? 'passed' : 'failed';

  // Gate 2: real paid core orders inside the pre-sale window (admin comps are not orders).
  const cohorts = await db.select().from(schema.cohorts).orderBy(schema.cohorts.startDate);
  const presale = cohorts[0];
  const [g2] = await db
    .select({ n: count() })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.sku, CORE_SKU),
        eq(schema.orders.status, 'paid'),
        eq(schema.orders.isTest, false),
        presale ? gte(schema.orders.paidAt, presale.enrollmentOpensAt) : undefined,
        presale ? lt(schema.orders.paidAt, presale.enrollmentClosesAt) : undefined,
      ),
    );
  const paidCount = g2?.n ?? 0;
  const windowOver = presale ? now > presale.enrollmentClosesAt : false;
  const gate2: GateStatus =
    paidCount >= settings.gate2_target ? 'passed' : windowOver ? 'failed' : presale && now >= presale.enrollmentOpensAt ? 'on track' : 'waiting';

  // Gate 3, per cohort, once Day 14 has unlocked.
  const gate3 = [];
  for (const c of cohorts) {
    const day14 = lagosDateTime(addDays(c.startDate, 10), settings.unlock_time_local);
    const paidStudents = await db
      .selectDistinct({ id: schema.orders.studentId })
      .from(schema.orders)
      .where(and(eq(schema.orders.cohortId, c.id), eq(schema.orders.status, 'paid'), eq(schema.orders.isTest, false)));
    const ids = paidStudents.map((p) => p.id);
    const [refunded] = await db
      .select({ n: count() })
      .from(schema.orders)
      .where(and(eq(schema.orders.cohortId, c.id), eq(schema.orders.status, 'refunded'), eq(schema.orders.isTest, false)));
    let day7 = 0;
    let day14Done = 0;
    if (ids.length) {
      const [a] = await db
        .select({ n: countDistinct(schema.questionAttempts.studentId) })
        .from(schema.questionAttempts)
        .where(and(eq(schema.questionAttempts.day, 7), inArray(schema.questionAttempts.studentId, ids)));
      const [b] = await db
        .select({ n: countDistinct(schema.lessonProgress.studentId) })
        .from(schema.lessonProgress)
        .where(
          and(eq(schema.lessonProgress.day, 14), isNotNull(schema.lessonProgress.completedAt), inArray(schema.lessonProgress.studentId, ids)),
        );
      day7 = a?.n ?? 0;
      day14Done = b?.n ?? 0;
    }
    const refundN = refunded?.n ?? 0;
    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
    const metrics = {
      paid: ids.length,
      day7ActivePct: pct(day7, ids.length),
      day14FinishPct: pct(day14Done, ids.length),
      refundPct: pct(refundN, ids.length + refundN),
    };
    const unlocked = now >= day14;
    const pass =
      metrics.day7ActivePct >= settings.gate3_day7_active_pct &&
      metrics.day14FinishPct >= settings.gate3_day14_finish_pct &&
      metrics.refundPct <= settings.gate3_refund_max_pct;
    gate3.push({ cohort: c.name, cohortId: c.id, day14UnlocksAt: day14, ...metrics, status: (!unlocked ? 'waiting' : pass ? 'passed' : 'failed') as GateStatus });
  }

  // Gate 4: add-on or rewarded referral share, and one cheap channel.
  const [buyers] = await db
    .select({ n: countDistinct(schema.orders.studentId) })
    .from(schema.orders)
    .where(and(eq(schema.orders.sku, CORE_SKU), eq(schema.orders.status, 'paid'), eq(schema.orders.isTest, false)));
  const [addon] = await db
    .select({ n: countDistinct(schema.orders.studentId) })
    .from(schema.orders)
    .innerJoin(schema.products, eq(schema.products.sku, schema.orders.sku))
    .where(and(ne(schema.products.kind, 'core'), eq(schema.orders.status, 'paid'), eq(schema.orders.isTest, false)));
  const [referrers] = await db
    .select({ n: countDistinct(schema.referrals.referrerStudentId) })
    .from(schema.referrals)
    .where(eq(schema.referrals.status, 'rewarded'));
  const buyerN = buyers?.n ?? 0;
  // A student may count for both; this upper bound is clamped to the buyer count.
  const extra = Math.min(buyerN, (addon?.n ?? 0) + (referrers?.n ?? 0));
  const extraPct = buyerN ? Math.round((extra / buyerN) * 1000) / 10 : 0;
  const ch = await channels({ from: new Date(0), to: now });
  const cheap = ch.filter(
    (c) => c.spendKobo != null && c.cacKobo != null && c.cacKobo <= settings.gate4_cac_max_kobo && c.paid >= settings.gate4_min_orders,
  );
  const gate4: GateStatus =
    buyerN === 0 ? 'waiting' : extraPct >= settings.gate4_extra_pct && cheap.length > 0 ? 'passed' : 'on track';

  return {
    gate1: { done, confirmed, status: gate1 },
    gate2: { paid: paidCount, target: settings.gate2_target, status: gate2, window: presale ? { from: presale.enrollmentOpensAt, to: presale.enrollmentClosesAt } : null },
    gate3,
    gate4: { buyers: buyerN, extraPct, cheapChannels: cheap.map((c) => c.source), status: gate4 },
  };
}

export async function todayStrip(settings: Settings, now = new Date()) {
  const db = await getDb();
  const start = lagosDateTime(toLagosDate(now), '00:00');
  const [signups] = await db.select({ n: count() }).from(schema.students).where(gte(schema.students.createdAt, start));
  const [paidToday] = await db
    .select({ n: count() })
    .from(schema.orders)
    .where(and(eq(schema.orders.status, 'paid'), gte(schema.orders.paidAt, start)));
  const [active] = await db
    .select({ n: countDistinct(schema.questionAttempts.studentId) })
    .from(schema.questionAttempts)
    .where(gte(schema.questionAttempts.createdAt, start));
  const statusCount = async (s: 'needs_review' | 'duplicate') =>
    (await db.select({ n: count() }).from(schema.orders).where(eq(schema.orders.status, s)))[0]?.n ?? 0;
  const [openReports] = await db.select({ n: count() }).from(schema.questionReports).where(eq(schema.questionReports.status, 'open'));
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [sigFail] = await db
    .select({ n: count() })
    .from(schema.paymentEvents)
    .where(and(eq(schema.paymentEvents.signatureValid, false), gte(schema.paymentEvents.receivedAt, dayAgo)));
  const [pushFail] = await db
    .select({ n: count() })
    .from(schema.reminderLog)
    .where(and(eq(schema.reminderLog.result, 'failed'), gte(schema.reminderLog.sentAt, dayAgo)));

  // Lessons that have unlocked for someone but cannot be served.
  const content = getContent();
  const allow = allowUnreviewed();
  const cohorts = await db.select().from(schema.cohorts).where(eq(schema.cohorts.active, true));
  const unavailable = new Set<number>();
  for (let day = 1; day <= 14; day++) {
    const item = content.lessons.get(day);
    if (item && isServable(item, allow)) continue;
    const opened =
      day <= 3
        ? true
        : cohorts.some((c) => {
            const at = unlockAt(day, now, { revokedAt: null, expiresAt: new Date(8.64e15), cohortStartDate: c.startDate }, settings.unlock_time_local, now);
            return at != null && at <= now;
          });
    if (opened) unavailable.add(day);
  }

  return {
    signupsToday: signups?.n ?? 0,
    paidToday: paidToday?.n ?? 0,
    activeToday: active?.n ?? 0,
    alerts: {
      needsReview: await statusCount('needs_review'),
      duplicates: await statusCount('duplicate'),
      unavailableDays: [...unavailable],
      openReports: openReports?.n ?? 0,
      webhookSignatureFailures: sigFail?.n ?? 0,
      failedPushes: pushFail?.n ?? 0,
    },
  };
}

/** Paid students who have not started either of their last two unlocked days. */
export async function nudgeList(settings: Settings, now = new Date()) {
  const db = await getDb();
  const rows = await db
    .select({ student: schema.students, ent: schema.entitlements, cohort: schema.cohorts })
    .from(schema.entitlements)
    .innerJoin(schema.students, eq(schema.students.id, schema.entitlements.studentId))
    .innerJoin(schema.cohorts, eq(schema.cohorts.id, schema.entitlements.cohortId))
    .where(and(isNull(schema.entitlements.revokedAt), gte(schema.entitlements.expiresAt, now), isNull(schema.students.deletedAt)));
  const out = [];
  for (const { student, ent, cohort } of rows) {
    const entLike = { revokedAt: ent.revokedAt, expiresAt: ent.expiresAt, cohortStartDate: cohort.startDate };
    const unlocked: number[] = [];
    for (let day = 1; day <= 14; day++) {
      const at = unlockAt(day, student.createdAt, entLike, settings.unlock_time_local, now);
      if (at && at <= now) unlocked.push(day);
    }
    const lastTwo = unlocked.slice(-2);
    if (lastTwo.length < 2 || !lastTwo.some((d) => d >= 4)) continue;
    const started = await db
      .select({ day: schema.lessonProgress.day })
      .from(schema.lessonProgress)
      .where(and(eq(schema.lessonProgress.studentId, student.id), inArray(schema.lessonProgress.day, lastTwo)));
    if (started.length) continue;
    const [reached] = await db
      .select({ day: sql<number>`max(${schema.lessonProgress.day})` })
      .from(schema.lessonProgress)
      .where(and(eq(schema.lessonProgress.studentId, student.id), isNotNull(schema.lessonProgress.completedAt)));
    const nudged = await db
      .select({ day: schema.reminderLog.day, sentAt: schema.reminderLog.sentAt })
      .from(schema.reminderLog)
      .where(and(eq(schema.reminderLog.studentId, student.id), eq(schema.reminderLog.channel, 'whatsapp_manual')))
      .orderBy(desc(schema.reminderLog.sentAt))
      .limit(1);
    out.push({
      studentId: student.id,
      firstName: student.firstName ?? '',
      phone: student.phoneE164 ?? '',
      lastSeenAt: student.lastSeenAt,
      reachedDay: reached?.day ?? 0,
      nextDay: lastTwo[0]!,
      lastNudge: nudged[0] ?? null,
    });
  }
  return out;
}
