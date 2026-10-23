import { createHmac } from 'node:crypto';
import { safeEqual } from '../crypto';
import {
  ProviderError,
  type ParsedWebhook,
  type PaymentProvider,
  type VerifyResult,
  type VerifyStatus,
} from './provider';

// Checked against Paystack's official OpenAPI spec (github.com/PaystackOSS/openapi,
// dist/paystack.yaml) and webhook samples (PaystackOSS/doc-code-snippets):
// - POST /transaction/initialize {email, amount (kobo), currency, reference,
//   callback_url, metadata, channels} -> data.authorization_url, access_code, reference
// - GET /transaction/verify/{reference} -> data.status, amount, currency, reference, id, paid_at
// - Webhooks: header x-paystack-signature = HMAC-SHA512 (hex) of the raw body,
//   keyed with the secret key. Paystack sends no event id, so the event key is
//   built from event type, transaction id and reference.

const API = 'https://api.paystack.co';

/**
 * Paystack reports a transaction the customer has not finished as "abandoned",
 * so it is not final; the order stays pending until housekeeping expires it.
 */
export function mapPaystackStatus(s: string | undefined): VerifyStatus {
  switch (s) {
    case 'success':
      return 'success';
    case 'failed':
    case 'reversed':
      return 'failed';
    case 'abandoned':
      return 'abandoned';
    default:
      return 'pending'; // ongoing, pending, processing, queued
  }
}

type PaystackTx = {
  id?: number;
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  paid_at?: string | null;
  channel?: string;
  gateway_response?: string;
  created_at?: string;
};

/** Keeps only fields we need. Never stores customer, card or authorization data. */
export function redactPaystackTx(d: PaystackTx | undefined) {
  if (!d) return null;
  return {
    id: d.id,
    status: d.status,
    reference: d.reference,
    amount: d.amount,
    currency: d.currency,
    paid_at: d.paid_at ?? null,
    channel: d.channel,
    gateway_response: d.gateway_response,
    created_at: d.created_at,
  };
}

export function paystackSignature(rawBody: string, secret: string): string {
  return createHmac('sha512', secret).update(rawBody, 'utf8').digest('hex');
}

export function createPaystackProvider(
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
): PaymentProvider {
  async function call(path: string, init: RequestInit): Promise<{ status: boolean; message: string; data?: unknown }> {
    let res: Response;
    try {
      res = await fetchImpl(`${API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new ProviderError(`Paystack unreachable: ${(e as Error).message}`, true);
    }
    let body: { status: boolean; message: string; data?: unknown };
    try {
      body = await res.json();
    } catch {
      throw new ProviderError(`Paystack returned ${res.status} with an unreadable body`, res.status >= 500);
    }
    if (!res.ok || !body.status) {
      throw new ProviderError(`Paystack ${path.split('/')[2]} failed (${res.status}): ${body.message}`, res.status >= 500);
    }
    return body;
  }

  return {
    name: 'paystack',
    async initialize(input) {
      const body = await call('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email: input.email,
          amount: input.amountKobo,
          currency: input.currency,
          reference: input.reference,
          callback_url: input.callbackUrl,
          metadata: input.metadata,
          channels: ['card', 'bank', 'ussd', 'bank_transfer'],
        }),
      });
      const data = body.data as { authorization_url?: string; reference?: string } | undefined;
      if (!data?.authorization_url) throw new ProviderError('Paystack gave no authorization_url', true);
      return { authorizationUrl: data.authorization_url, providerReference: data.reference };
    },

    async verify(reference): Promise<VerifyResult> {
      const body = await call(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
      const d = (body.data ?? {}) as PaystackTx;
      return {
        status: mapPaystackStatus(d.status),
        amountKobo: typeof d.amount === 'number' ? d.amount : -1,
        currency: d.currency ?? '',
        reference: d.reference ?? '',
        providerReference: d.id != null ? String(d.id) : '',
        paidAt: d.paid_at ? new Date(d.paid_at) : undefined,
        raw: redactPaystackTx(d),
      };
    },

    parseWebhook(rawBody, headers): ParsedWebhook {
      const sig = headers.get('x-paystack-signature') ?? '';
      const valid = sig.length > 0 && safeEqual(sig, paystackSignature(rawBody, secretKey));
      let event: { event?: string; data?: PaystackTx } = {};
      try {
        event = JSON.parse(rawBody);
      } catch {
        return { valid: false, eventKey: 'unparseable', type: 'unparseable' };
      }
      const type = typeof event.event === 'string' ? event.event : 'unknown';
      const reference = event.data?.reference;
      return {
        valid,
        type,
        reference,
        eventKey: `${type}:${event.data?.id ?? ''}:${reference ?? ''}`,
        redacted: { event: type, data: redactPaystackTx(event.data) },
      };
    },
  };
}
