import 'server-only';
import { and, count, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { Student } from '@/db/schema';
import { CORE_SKU, getAccess } from './access';
import { channelOf } from './attribution';
import { orderReference } from './crypto';
import { env } from './env';
import { logServer, recordEvent } from './events';
import { absoluteUrl } from './http';
import { getPaymentProvider, paymentsReady } from './payments';
import { ProviderError } from './payments/provider';
import { openCohort, resolvePriceKobo } from './rules';
import type { Settings } from './settings';

export async function paidCoreOrderCount(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: count() })
    .from(schema.orders)
    .where(and(eq(schema.orders.sku, CORE_SKU), eq(schema.orders.status, 'paid'), eq(schema.orders.isTest, false)));
  return row?.n ?? 0;
}

export async function currentOffer(settings: Settings, now = new Date()) {
  const db = await getDb();
  const [cohorts, paid, product] = await Promise.all([
    db.select().from(schema.cohorts),
    paidCoreOrderCount(),
    db.query.products.findFirst({ where: eq(schema.products.sku, CORE_SKU) }),
  ]);
  // No payment key yet means no open enrolment, so nobody reaches a broken checkout.
  const cohort = paymentsReady() ? openCohort(cohorts, now) : null;
  const price = resolvePriceKobo(settings, paid, now);
  return { cohort, paid, product, ...price };
}

/** The email Paystack needs. Placeholder only if the owner configured one. */
export function paymentEmail(student: Pick<Student, 'id' | 'email'>): string | null {
  if (student.email) return student.email;
  const domain = env().PAYMENT_PLACEHOLDER_EMAIL_DOMAIN;
  return domain ? `student-${student.id.slice(0, 8)}@${domain}` : null;
}

export type CheckoutResult =
  | { ok: true; reference: string; paymentUrl: string }
  | { ok: false; code: 'ENROLMENT_CLOSED' | 'ALREADY_ENROLLED' | 'EMAIL_REQUIRED' | 'SERVER_ERROR' };

export async function startCheckout(
  student: Student,
  settings: Settings,
  opts: { email?: string; isTest?: boolean } = {},
  now = new Date(),
): Promise<CheckoutResult> {
  const access = await getAccess(student.id, now);
  if (access.active) return { ok: false, code: 'ALREADY_ENROLLED' };
  const offer = await currentOffer(settings, now);
  if (!offer.cohort || !offer.product?.active) return { ok: false, code: 'ENROLMENT_CLOSED' };

  const db = await getDb();
  if (opts.email && !student.email) {
    await db.update(schema.students).set({ email: opts.email }).where(eq(schema.students.id, student.id));
    student = { ...student, email: opts.email };
  }
  const email = paymentEmail(student);
  if (!email) return { ok: false, code: 'EMAIL_REQUIRED' };

  const reference = orderReference();
  const provider = getPaymentProvider();
  const [order] = await db
    .insert(schema.orders)
    .values({
      studentId: student.id,
      sku: CORE_SKU,
      amountKobo: offer.priceKobo,
      currency: 'NGN',
      status: 'pending',
      provider: provider.name,
      reference,
      cohortId: offer.cohort.id,
      channel: channelOf(student.firstTouch),
      isTest: opts.isTest ?? (env().PAYMENT_PROVIDER === 'fake' || Boolean(env().PAYSTACK_SECRET_KEY?.startsWith('sk_test_'))),
    })
    .returning();
  await recordEvent(
    'checkout_started',
    { sku: CORE_SKU, amount_kobo: offer.priceKobo },
    { studentId: student.id, attribution: student.firstTouch },
  );

  try {
    const init = await provider.initialize({
      reference,
      amountKobo: offer.priceKobo,
      currency: 'NGN',
      email,
      callbackUrl: absoluteUrl(`/buy/return?reference=${reference}`),
      metadata: { order_id: order!.id, student_id: student.id },
    });
    return { ok: true, reference, paymentUrl: init.authorizationUrl };
  } catch (e) {
    logServer('error', 'payment initialize failed', {
      reference,
      retryable: e instanceof ProviderError ? e.retryable : null,
      message: (e as Error).message,
    });
    await db.update(schema.orders).set({ status: 'failed' }).where(eq(schema.orders.id, order!.id));
    return { ok: false, code: 'SERVER_ERROR' };
  }
}
