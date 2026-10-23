import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { CORE_SKU, getAccess, liveEntitlementRows } from './access';
import { settleOrder } from './payments/settle';
import { issueRecoveryCode } from './session';
import { deleteStudent } from './students';
import { addDays, lagosDateTime } from './time';

// Every function here is called from an admin route that also writes the audit log.

/** Owner refunded in the provider dashboard; record it and revoke access. */
export async function markRefunded(orderId: string, now = new Date()) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for('update');
    if (!order) return { ok: false as const, message: 'Order not found.' };
    if (!['paid', 'duplicate', 'needs_review'].includes(order.status))
      return { ok: false as const, message: `Only paid, duplicate or review orders can be refunded (this one is ${order.status}).` };
    await tx.update(schema.orders).set({ status: 'refunded', refundedAt: now }).where(eq(schema.orders.id, order.id));
    await tx
      .update(schema.entitlements)
      .set({ revokedAt: now, note: 'refunded' })
      .where(and(eq(schema.entitlements.orderId, order.id), isNull(schema.entitlements.revokedAt)));
    await tx
      .update(schema.referrals)
      .set({ status: 'void', voidReason: 'refunded' })
      .where(and(eq(schema.referrals.orderId, order.id), eq(schema.referrals.status, 'pending')));
    return { ok: true as const };
  });
}

export async function reverifyOrder(orderId: string) {
  const db = await getDb();
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) return { ok: false as const, message: 'Order not found.' };
  const r = await settleOrder(order.reference, { source: 'admin' });
  return { ok: true as const, message: `Provider check: ${r.outcome}.` };
}

/** After checking the provider dashboard, grant access for a needs_review order. */
export async function resolveReview(orderId: string, now = new Date()) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for('update');
    if (!order || order.status !== 'needs_review') return { ok: false as const, message: 'Only orders in review can be resolved.' };
    const live = (await liveEntitlementRows(tx, order.studentId, order.sku)).filter((e) => e.expiresAt > now);
    if (live.length) {
      await tx.update(schema.orders).set({ status: 'duplicate' }).where(eq(schema.orders.id, order.id));
      return { ok: true as const, message: 'The student already had access, so this order is now marked duplicate.' };
    }
    const cohort = order.cohortId ? await tx.query.cohorts.findFirst({ where: eq(schema.cohorts.id, order.cohortId) }) : null;
    const product = await tx.query.products.findFirst({ where: eq(schema.products.sku, order.sku) });
    if (!cohort || !product) return { ok: false as const, message: 'The order has no cohort; grant access by hand instead.' };
    await tx.update(schema.orders).set({ status: 'paid', paidAt: order.paidAt ?? now }).where(eq(schema.orders.id, order.id));
    await tx.insert(schema.entitlements).values({
      studentId: order.studentId,
      sku: order.sku,
      orderId: order.id,
      source: 'purchase',
      cohortId: cohort.id,
      grantedAt: now,
      expiresAt: lagosDateTime(addDays(cohort.startDate, product.accessDays), '00:00'),
      note: 'resolved from review by admin',
    });
    return { ok: true as const, message: 'Access granted.' };
  });
}

export async function markDuplicate(orderId: string) {
  const db = await getDb();
  await db.update(schema.orders).set({ status: 'duplicate' }).where(eq(schema.orders.id, orderId));
  return { ok: true as const };
}

/** Manual access (admin_comp). Never counted as a sale. */
export async function grantAccess(studentId: string, cohortId: string, note: string, now = new Date()) {
  const db = await getDb();
  const access = await getAccess(studentId, now);
  if (access.active) return { ok: false as const, message: 'This student already has access.' };
  const cohort = await db.query.cohorts.findFirst({ where: eq(schema.cohorts.id, cohortId) });
  const product = await db.query.products.findFirst({ where: eq(schema.products.sku, CORE_SKU) });
  if (!cohort || !product) return { ok: false as const, message: 'Choose a cohort.' };
  await db.transaction(async (tx) => {
    for (const e of await liveEntitlementRows(tx, studentId, CORE_SKU))
      await tx.update(schema.entitlements).set({ revokedAt: now, note: 'expired; superseded' }).where(eq(schema.entitlements.id, e.id));
    await tx.insert(schema.entitlements).values({
      studentId,
      sku: CORE_SKU,
      source: 'admin_comp',
      cohortId: cohort.id,
      grantedAt: now,
      expiresAt: lagosDateTime(addDays(cohort.startDate, product.accessDays), '00:00'),
      note: note.slice(0, 300) || null,
    });
  });
  return { ok: true as const };
}

export async function revokeAccess(studentId: string, note: string, now = new Date()) {
  const db = await getDb();
  await db
    .update(schema.entitlements)
    .set({ revokedAt: now, note: note.slice(0, 300) || 'revoked by admin' })
    .where(and(eq(schema.entitlements.studentId, studentId), isNull(schema.entitlements.revokedAt)));
  return { ok: true as const };
}

export async function adminNewRecoveryCode(studentId: string) {
  const db = await getDb();
  const code = await db.transaction((tx) => issueRecoveryCode(tx, studentId));
  return code;
}

export async function adminDeleteStudent(studentId: string) {
  await deleteStudent(studentId);
}
