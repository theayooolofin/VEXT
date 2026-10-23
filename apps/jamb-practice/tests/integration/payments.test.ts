import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb, schema } from '@/db';
import { markRefunded } from '@/lib/adminActions';
import { fakeSetOutcome, fakeWebhook } from '@/lib/payments/fake';
import { settleOrder } from '@/lib/payments/settle';
import { absorb, ageStudent, client, freshDb, req, signUp, startCohortDaysAgo, studentIdOf, type Client } from './helpers';
import { POST as checkout } from '../../app/api/checkout/route';
import { GET as orderStatus } from '../../app/api/orders/[reference]/status/route';
import { POST as webhook } from '../../app/api/webhooks/paystack/route';
import { GET as lesson } from '../../app/api/lessons/[n]/route';

async function startCheckout(c: Client) {
  const res = await checkout(req(c, 'POST', '/api/checkout', { sku: 'core-14' }));
  expect(res.status).toBe(200);
  return (await res.json()) as { orderReference: string; paymentUrl: string };
}

const status = async (c: Client, reference: string) => {
  const res = await orderStatus(req(c, 'GET', `/api/orders/${reference}/status`), { params: Promise.resolve({ reference }) });
  return (await res.json()) as { status: string; accessMissing: boolean };
};

const sendWebhook = (reference: string, tamper = false) => {
  const { body, signature } = fakeWebhook(reference);
  return webhook(
    new Request('https://vextglobal.test/jamb-practice/api/webhooks/paystack', {
      method: 'POST',
      headers: { 'x-paystack-signature': signature, 'content-type': 'application/json' },
      body: tamper ? body.replace('charge.success', 'charge.succesz') : body,
    }),
  );
};

async function counts(studentId: string) {
  const db = await getDb();
  const orders = await db.select().from(schema.orders).where(eq(schema.orders.studentId, studentId));
  const ents = await db.select().from(schema.entitlements).where(eq(schema.entitlements.studentId, studentId));
  return { orders, ents };
}

beforeAll(async () => {
  await freshDb();
});

describe('payment settlement', () => {
  it('settles through the return path: one paid order, one entitlement', async () => {
    const c = client();
    await signUp(c);
    const { orderReference, paymentUrl } = await startCheckout(c);
    expect(paymentUrl).toContain('/dev/fake-pay');
    expect((await status(c, orderReference)).status).toBe('pending');
    fakeSetOutcome(orderReference, 'success');
    expect((await status(c, orderReference)).status).toBe('paid');
    const { orders, ents } = await counts(await studentIdOf(c));
    expect(orders.filter((o) => o.status === 'paid')).toHaveLength(1);
    expect(ents).toHaveLength(1);
    expect(ents[0]!.source).toBe('purchase');
    // Access lasts until the cohort start plus 90 days.
    expect(ents[0]!.expiresAt.toISOString()).toBe('2027-02-13T23:00:00.000Z');
  });

  it('settles through the webhook path', async () => {
    const c = client();
    await signUp(c);
    const { orderReference } = await startCheckout(c);
    fakeSetOutcome(orderReference, 'success');
    const res = await sendWebhook(orderReference);
    expect(res.status).toBe(200);
    const { orders, ents } = await counts(await studentIdOf(c));
    expect(orders[0]!.status).toBe('paid');
    expect(ents).toHaveLength(1);
  });

  it('is idempotent: five webhooks plus concurrent return checks grant once', async () => {
    const c = client();
    await signUp(c);
    const { orderReference } = await startCheckout(c);
    fakeSetOutcome(orderReference, 'success');
    const results = await Promise.all([
      ...Array.from({ length: 5 }, () => sendWebhook(orderReference)),
      status(c, orderReference),
      status(c, orderReference),
      settleOrder(orderReference, { source: 'test' }),
    ]);
    for (const r of results.slice(0, 5)) expect((r as Response).status).toBe(200);
    const { orders, ents } = await counts(await studentIdOf(c));
    expect(orders.filter((o) => o.status === 'paid')).toHaveLength(1);
    expect(ents).toHaveLength(1);
    const db = await getDb();
    const events = await db.select().from(schema.paymentEvents).where(eq(schema.paymentEvents.reference, orderReference));
    expect(events).toHaveLength(1);
  });

  it('rejects a forged webhook with 401 and grants nothing', async () => {
    const c = client();
    await signUp(c);
    const { orderReference } = await startCheckout(c);
    fakeSetOutcome(orderReference, 'success');
    const res = await sendWebhook(orderReference, true);
    expect(res.status).toBe(401);
    const db = await getDb();
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.reference, orderReference) });
    expect(order!.status).toBe('pending');
    const bad = await db.select().from(schema.paymentEvents).where(eq(schema.paymentEvents.signatureValid, false));
    expect(bad.length).toBeGreaterThan(0);
  });

  it('a different amount sets needs_review and grants nothing', async () => {
    const c = client();
    await signUp(c);
    const { orderReference } = await startCheckout(c);
    fakeSetOutcome(orderReference, 'success', { amountKobo: 100 });
    expect((await status(c, orderReference)).status).toBe('needs_review');
    const { ents } = await counts(await studentIdOf(c));
    expect(ents).toHaveLength(0);
  });

  it('a different currency sets needs_review', async () => {
    const c = client();
    await signUp(c);
    const { orderReference } = await startCheckout(c);
    fakeSetOutcome(orderReference, 'success', { currency: 'USD' });
    expect((await status(c, orderReference)).status).toBe('needs_review');
  });

  it('a failed payment marks the order failed and grants nothing', async () => {
    const c = client();
    await signUp(c);
    const { orderReference } = await startCheckout(c);
    fakeSetOutcome(orderReference, 'failed');
    expect((await status(c, orderReference)).status).toBe('failed');
    expect((await counts(await studentIdOf(c))).ents).toHaveLength(0);
  });

  it('a second paid order for the same student becomes duplicate and grants nothing', async () => {
    const c = client();
    await signUp(c);
    const a = await startCheckout(c);
    const b = await startCheckout(c); // second tab, before the first is paid
    fakeSetOutcome(a.orderReference, 'success');
    fakeSetOutcome(b.orderReference, 'success');
    expect((await status(c, a.orderReference)).status).toBe('paid');
    expect((await status(c, b.orderReference)).status).toBe('duplicate');
    const { ents } = await counts(await studentIdOf(c));
    expect(ents).toHaveLength(1);
  });

  it('refuses a new checkout for a student who already has access', async () => {
    const c = client();
    await signUp(c);
    const { orderReference } = await startCheckout(c);
    fakeSetOutcome(orderReference, 'success');
    await status(c, orderReference);
    const res = await checkout(req(c, 'POST', '/api/checkout', { sku: 'core-14' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('ALREADY_ENROLLED');
  });

  it('marking refunded revokes access and the lesson API returns NEEDS_PAYMENT', async () => {
    const c = client();
    await signUp(c);
    const sid = await studentIdOf(c);
    await ageStudent(sid, 20);
    const { orderReference } = await startCheckout(c);
    fakeSetOutcome(orderReference, 'success');
    await status(c, orderReference);
    await startCohortDaysAgo(3);
    const open = await lesson(req(c, 'GET', '/api/lessons/4'), { params: Promise.resolve({ n: '4' }) });
    expect(open.status).toBe(200);

    const db = await getDb();
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.reference, orderReference) });
    expect((await markRefunded(order!.id)).ok).toBe(true);
    const after = await lesson(req(c, 'GET', '/api/lessons/4'), { params: Promise.resolve({ n: '4' }) });
    expect(after.status).toBe(403);
    expect((await after.json()).error.code).toBe('NEEDS_PAYMENT');
    const ent = await db.query.entitlements.findFirst({ where: and(eq(schema.entitlements.orderId, order!.id)) });
    expect(ent!.revokedAt).not.toBeNull();
  });

  it('closed enrolment creates no order', async () => {
    const db = await getDb();
    await db.update(schema.cohorts).set({ enrollmentClosesAt: new Date(Date.now() - 1000) });
    const c = client();
    await signUp(c);
    const res = await checkout(req(c, 'POST', '/api/checkout', { sku: 'core-14' }));
    expect((await res.json()).error.code).toBe('ENROLMENT_CLOSED');
    expect((await counts(await studentIdOf(c))).orders).toHaveLength(0);
    await db.update(schema.cohorts).set({ enrollmentClosesAt: new Date(Date.now() + 7 * 86_400_000) });
  });

  it('checkout needs a signed-in student and the CSRF token', async () => {
    const anon = client();
    expect((await checkout(req(anon, 'POST', '/api/checkout', { sku: 'core-14' }))).status).toBe(401);
    const c = client();
    absorb(c, await signUp(c));
    const noCsrf = { ...c, csrf: undefined };
    expect((await checkout(req(noCsrf, 'POST', '/api/checkout', { sku: 'core-14' }))).status).toBe(403);
    expect((await checkout(req(c, 'POST', '/api/checkout', { sku: 'core-14' }, { origin: 'https://evil.test' }))).status).toBe(403);
  });
});
