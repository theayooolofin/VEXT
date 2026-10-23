import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb, schema, type Tx } from '@/db';
import { liveEntitlementRows } from '../access';
import { recordEvent, logServer } from '../events';
import { addDays, lagosDateTime } from '../time';
import { getPaymentProvider } from './index';
import type { VerifyResult } from './provider';

export type SettleOutcome =
  | 'paid'
  | 'already_paid'
  | 'pending'
  | 'failed'
  | 'needs_review'
  | 'duplicate'
  | 'not_found'
  | 'final';

const FINAL = new Set(['paid', 'refunded', 'duplicate', 'needs_review']);

/**
 * The one routine that turns a payment into access. Used by the return page,
 * the webhook, housekeeping and the admin "re-verify" button.
 *
 * The provider is asked first, outside the transaction. Then the order row is
 * locked, its status re-read, and access granted at most once. Concurrent
 * callers serialise on the lock; the loser sees "paid" and does nothing.
 */
export async function settleOrder(
  reference: string,
  opts: { source: string; verified?: VerifyResult; now?: Date } = { source: 'unknown' },
): Promise<{ outcome: SettleOutcome; status?: string }> {
  const db = await getDb();
  const now = opts.now ?? new Date();

  const existing = await db.query.orders.findFirst({ where: eq(schema.orders.reference, reference) });
  if (!existing) return { outcome: 'not_found' };
  if (existing.status === 'paid') return { outcome: 'already_paid', status: 'paid' };
  if (FINAL.has(existing.status)) return { outcome: 'final', status: existing.status };

  const v = opts.verified ?? (await getPaymentProvider().verify(reference));

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.reference, reference))
      .for('update');
    if (!order) return { outcome: 'not_found' as const };
    if (order.status === 'paid') return { outcome: 'already_paid' as const, status: 'paid' };
    if (FINAL.has(order.status)) return { outcome: 'final' as const, status: order.status };

    if (v.status === 'pending' || v.status === 'abandoned') {
      return { outcome: 'pending' as const, status: order.status };
    }

    if (v.status === 'failed') {
      await tx
        .update(schema.orders)
        .set({ status: 'failed', verifyPayload: v.raw ?? null })
        .where(eq(schema.orders.id, order.id));
      await recordEvent('payment_failed', { reason: 'provider_failed' }, { studentId: order.studentId }, tx);
      return { outcome: 'failed' as const, status: 'failed' };
    }

    // status === 'success': everything must match what we asked for.
    const matches =
      v.amountKobo === order.amountKobo && v.currency === 'NGN' && v.reference === order.reference;
    if (!matches) {
      await tx
        .update(schema.orders)
        .set({ status: 'needs_review', verifyPayload: v.raw ?? null, providerReference: v.providerReference || null })
        .where(eq(schema.orders.id, order.id));
      logServer('error', 'payment mismatch', {
        reference: order.reference,
        expectedKobo: order.amountKobo,
        gotKobo: v.amountKobo,
        currency: v.currency,
        source: opts.source,
      });
      return { outcome: 'needs_review' as const, status: 'needs_review' };
    }

    const outcome = await grantForPaidOrder(tx, order, v, now);
    logServer('info', 'order settled', { reference: order.reference, outcome, source: opts.source });
    return { outcome, status: outcome };
  });
}

async function grantForPaidOrder(
  tx: Tx,
  order: typeof schema.orders.$inferSelect,
  v: VerifyResult,
  now: Date,
): Promise<'paid' | 'duplicate' | 'needs_review'> {
  const product = await tx.query.products.findFirst({ where: eq(schema.products.sku, order.sku) });
  const cohort = order.cohortId
    ? await tx.query.cohorts.findFirst({ where: eq(schema.cohorts.id, order.cohortId) })
    : undefined;
  const base = {
    providerReference: v.providerReference || null,
    paidAt: v.paidAt ?? now,
    verifyPayload: v.raw ?? null,
  };

  const live = await liveEntitlementRows(tx, order.studentId, order.sku);
  const stillActive = live.filter((e) => e.expiresAt.getTime() > now.getTime());
  if (stillActive.length > 0) {
    // Paid twice: keep the money traceable, grant nothing, flag for a manual refund.
    await tx.update(schema.orders).set({ ...base, status: 'duplicate' }).where(eq(schema.orders.id, order.id));
    logServer('warn', 'duplicate payment', { reference: order.reference });
    return 'duplicate';
  }
  // Expired rows still hold the one-live-entitlement slot; close them first.
  for (const e of live) {
    await tx
      .update(schema.entitlements)
      .set({ revokedAt: now, note: 'expired; superseded by a new purchase' })
      .where(eq(schema.entitlements.id, e.id));
  }

  if (!cohort || !product) {
    await tx.update(schema.orders).set({ ...base, status: 'needs_review' }).where(eq(schema.orders.id, order.id));
    logServer('error', 'paid order without cohort or product', { reference: order.reference });
    return 'needs_review';
  }

  await tx.update(schema.orders).set({ ...base, status: 'paid' }).where(eq(schema.orders.id, order.id));
  await tx.insert(schema.entitlements).values({
    studentId: order.studentId,
    sku: order.sku,
    orderId: order.id,
    source: 'purchase',
    cohortId: cohort.id,
    grantedAt: now,
    expiresAt: lagosDateTime(addDays(cohort.startDate, product.accessDays), '00:00'),
  });
  await recordEvent(
    'payment_succeeded',
    { sku: order.sku, amount_kobo: order.amountKobo },
    { studentId: order.studentId, attribution: { utm_source: order.channel } },
    tx,
  );
  return 'paid';
}
