import { paystackSignature, redactPaystackTx } from './paystack';
import type { PaymentProvider, VerifyStatus } from './provider';

// A faithful stand-in for tests and local development. It follows the same
// contract as Paystack, including signed webhooks, but never touches money.

export const FAKE_WEBHOOK_SECRET = 'fake-provider-webhook-secret';

type FakeTx = {
  reference: string;
  amountKobo: number;
  currency: string;
  status: VerifyStatus;
  id: number;
  paidAt?: Date;
  callbackUrl: string;
};

const g = globalThis as unknown as { __jpFakeTx?: Map<string, FakeTx>; __jpFakeId?: number };
const store = () => (g.__jpFakeTx ??= new Map());

export function fakeSetOutcome(
  reference: string,
  status: VerifyStatus,
  override?: { amountKobo?: number; currency?: string },
) {
  const tx = store().get(reference);
  if (!tx) return null;
  tx.status = status;
  if (status === 'success') tx.paidAt = new Date();
  if (override?.amountKobo != null) tx.amountKobo = override.amountKobo;
  if (override?.currency) tx.currency = override.currency;
  return tx;
}

export function fakeGet(reference: string) {
  return store().get(reference) ?? null;
}

/** Builds a signed charge.success body exactly as Paystack would. */
export function fakeWebhook(reference: string, secret = FAKE_WEBHOOK_SECRET) {
  const tx = store().get(reference);
  const body = JSON.stringify({
    event: 'charge.success',
    data: {
      id: tx?.id ?? 0,
      status: 'success',
      reference,
      amount: tx?.amountKobo ?? 0,
      currency: tx?.currency ?? 'NGN',
      customer: { email: 'redact-me@example.com' },
    },
  });
  return { body, signature: paystackSignature(body, secret) };
}

export function createFakeProvider(basePath: string): PaymentProvider {
  return {
    name: 'fake',
    async initialize(input) {
      g.__jpFakeId = (g.__jpFakeId ?? 1000) + 1;
      store().set(input.reference, {
        reference: input.reference,
        amountKobo: input.amountKobo,
        currency: input.currency,
        status: 'abandoned',
        id: g.__jpFakeId,
        callbackUrl: input.callbackUrl,
      });
      return {
        authorizationUrl: `${basePath}/dev/fake-pay?reference=${encodeURIComponent(input.reference)}`,
        providerReference: String(g.__jpFakeId),
      };
    },
    async verify(reference) {
      const tx = store().get(reference);
      if (!tx) return { status: 'pending', amountKobo: -1, currency: '', reference, providerReference: '', raw: null };
      return {
        status: tx.status,
        amountKobo: tx.amountKobo,
        currency: tx.currency,
        reference: tx.reference,
        providerReference: String(tx.id),
        paidAt: tx.paidAt,
        raw: redactPaystackTx({
          id: tx.id,
          status: tx.status,
          reference: tx.reference,
          amount: tx.amountKobo,
          currency: tx.currency,
        }),
      };
    },
    parseWebhook(rawBody, headers) {
      const sig = headers.get('x-paystack-signature') ?? '';
      const valid = sig === paystackSignature(rawBody, FAKE_WEBHOOK_SECRET);
      try {
        const e = JSON.parse(rawBody) as { event?: string; data?: { id?: number; reference?: string } };
        const type = e.event ?? 'unknown';
        return {
          valid,
          type,
          reference: e.data?.reference,
          eventKey: `${type}:${e.data?.id ?? ''}:${e.data?.reference ?? ''}`,
          redacted: { event: type, data: redactPaystackTx(e.data) },
        };
      } catch {
        return { valid: false, eventKey: 'unparseable', type: 'unparseable' };
      }
    },
  };
}
