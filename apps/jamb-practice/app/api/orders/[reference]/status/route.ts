import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getDb, schema } from '@/db';
import { getAccess } from '@/lib/access';
import { logServer } from '@/lib/events';
import { apiError, json } from '@/lib/http';
import { settleOrder } from '@/lib/payments/settle';
import { hit, LIMITS } from '@/lib/rateLimit';
import { requireStudent } from '@/lib/request';
import { getSettings } from '@/lib/settingsRepo';
import { lagosDateTime } from '@/lib/time';

export async function GET(req: NextRequest, ctx: { params: Promise<{ reference: string }> }) {
  const g = await requireStudent(req, { mutation: false });
  if (!g.ok) return g.res;
  const { reference } = await ctx.params;
  if (!/^JP-[A-Z0-9]{12}$/.test(reference)) return apiError('ORDER_NOT_FOUND', 404);
  if (!(await hit(LIMITS.orderStatus, g.session.student.id))) return apiError('RATE_LIMITED', 429);
  const db = await getDb();
  const owned = await db.query.orders.findFirst({
    where: and(eq(schema.orders.reference, reference), eq(schema.orders.studentId, g.session.student.id)),
  });
  if (!owned) return apiError('ORDER_NOT_FOUND', 404);

  let status: string = owned.status;
  if (status === 'pending' || status === 'failed') {
    try {
      const r = await settleOrder(reference, { source: 'return' });
      status = r.status ?? status;
    } catch (e) {
      // Provider unreachable: report pending, the webhook or housekeeping will settle it.
      logServer('warn', 'status verify failed', { reference, message: (e as Error).message });
    }
  }

  const cohort = owned.cohortId ? await db.query.cohorts.findFirst({ where: eq(schema.cohorts.id, owned.cohortId) }) : null;
  const settings = await getSettings();
  let accessMissing = false;
  if (status === 'paid') {
    const access = await getAccess(g.session.student.id);
    if (!access.active) {
      accessMissing = true;
      logServer('error', 'paid order without access', { reference });
    }
  }
  return json({
    status,
    sku: owned.sku,
    cohort: cohort ? { name: cohort.name, startDate: cohort.startDate } : null,
    firstLessonAt: cohort ? lagosDateTime(cohort.startDate, settings.unlock_time_local) : null,
    accessMissing,
  });
}
