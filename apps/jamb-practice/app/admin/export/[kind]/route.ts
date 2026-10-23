import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getDb, schema } from '@/db';
import { ADMIN_COOKIE, audit, readAdminCookie } from '@/lib/admin';
import { hashIp } from '@/lib/crypto';
import { toCsv } from '@/lib/csv';
import { clientIp } from '@/lib/http';
import { funnel } from '@/lib/stats';
import { addDays, lagosDateTime, toLagosDate } from '@/lib/time';

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  if (!readAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) return new Response('Sign in first.', { status: 401 });
  const { kind } = await ctx.params;
  const today = toLagosDate(new Date());
  const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const fromStr = valid(req.nextUrl.searchParams.get('from')) ?? addDays(today, -30);
  const toStr = valid(req.nextUrl.searchParams.get('to')) ?? today;
  const from = lagosDateTime(fromStr, '00:00');
  const to = lagosDateTime(addDays(toStr, 1), '00:00');
  const db = await getDb();
  let csv: string;

  if (kind === 'orders') {
    const rows = await db
      .select()
      .from(schema.orders)
      .where(and(gte(schema.orders.createdAt, from), lt(schema.orders.createdAt, to)))
      .orderBy(desc(schema.orders.createdAt));
    csv = toCsv(
      ['reference', 'status', 'sku', 'amount_naira', 'channel', 'created_at', 'paid_at', 'refunded_at', 'is_test'],
      rows.map((o) => [o.reference, o.status, o.sku, o.amountKobo / 100, o.channel, o.createdAt, o.paidAt, o.refundedAt, o.isTest]),
    );
  } else if (kind === 'students') {
    const rows = await db
      .select({ s: schema.students, e: schema.entitlements })
      .from(schema.students)
      .leftJoin(schema.entitlements, and(eq(schema.entitlements.studentId, schema.students.id), isNull(schema.entitlements.revokedAt)))
      .where(and(isNull(schema.students.deletedAt), gte(schema.students.createdAt, from), lt(schema.students.createdAt, to)));
    // Email is excluded on purpose (spec 10.3).
    csv = toCsv(
      ['first_name', 'phone', 'class', 'status', 'source', 'signed_up'],
      rows.map(({ s, e }) => [s.firstName, s.phoneE164, s.classLevel, e ? 'paid' : 'free', s.firstTouch.utm_source ?? 'direct', s.createdAt]),
    );
  } else if (kind === 'funnel') {
    const stages = await funnel({ from, to });
    csv = toCsv(['stage', 'count', 'pct_of_previous'], stages.map((s) => [s.label, s.n, s.pctOfPrev ?? '']));
  } else {
    return new Response('Unknown export', { status: 404 });
  }

  await audit('export', kind, { from: fromStr, to: toStr }, hashIp(clientIp(req)));
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${kind}-${fromStr}-to-${toStr}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
