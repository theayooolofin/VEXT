import { describe, expect, it, vi } from 'vitest';
import { createPaystackProvider, mapPaystackStatus, paystackSignature } from '@/lib/payments/paystack';

const SECRET = 'sk_test_example';
const body = JSON.stringify({
  event: 'charge.success',
  data: { id: 42, reference: 'JP-ABC', amount: 30000, currency: 'NGN', status: 'success', customer: { email: 'a@b.c' }, authorization: { last4: '4081' } },
});

describe('Paystack webhook signature', () => {
  const p = createPaystackProvider(SECRET);
  it('a valid signature passes', () => {
    const h = new Headers({ 'x-paystack-signature': paystackSignature(body, SECRET) });
    const r = p.parseWebhook(body, h);
    expect(r.valid).toBe(true);
    expect(r.type).toBe('charge.success');
    expect(r.reference).toBe('JP-ABC');
    expect(r.eventKey).toBe('charge.success:42:JP-ABC');
  });
  it('a modified body fails', () => {
    const h = new Headers({ 'x-paystack-signature': paystackSignature(body, SECRET) });
    expect(p.parseWebhook(body.replace('30000', '3000'), h).valid).toBe(false);
  });
  it('a missing header fails', () => {
    expect(p.parseWebhook(body, new Headers()).valid).toBe(false);
  });
  it('the stored copy has no customer or card data', () => {
    const r = p.parseWebhook(body, new Headers());
    expect(JSON.stringify(r.redacted)).not.toMatch(/a@b\.c|4081/);
  });
});

describe('Paystack API calls', () => {
  it('initialize sends kobo, reference and callback with the secret key', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ status: true, message: 'ok', data: { authorization_url: 'https://checkout.paystack.com/x', access_code: 'x', reference: 'JP-1' } }),
    );
    const p = createPaystackProvider(SECRET, fetchMock as unknown as typeof fetch);
    const r = await p.initialize({ reference: 'JP-1', amountKobo: 30000, currency: 'NGN', email: 'a@b.c', callbackUrl: 'https://x/cb', metadata: { order_id: 'o' } });
    expect(r.authorizationUrl).toBe('https://checkout.paystack.com/x');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.paystack.co/transaction/initialize');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
    expect(JSON.parse(init.body as string)).toMatchObject({ amount: 30000, currency: 'NGN', reference: 'JP-1', callback_url: 'https://x/cb' });
  });

  it('verify maps the response', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ status: true, message: 'ok', data: { id: 7, status: 'success', reference: 'JP-1', amount: 30000, currency: 'NGN', paid_at: '2026-11-03T10:00:00.000Z', customer: { email: 'x' } } }),
    );
    const p = createPaystackProvider(SECRET, fetchMock as unknown as typeof fetch);
    const v = await p.verify('JP-1');
    expect(v).toMatchObject({ status: 'success', amountKobo: 30000, currency: 'NGN', reference: 'JP-1', providerReference: '7' });
    expect(JSON.stringify(v.raw)).not.toContain('customer');
  });

  it('maps every documented status', () => {
    expect(mapPaystackStatus('success')).toBe('success');
    expect(mapPaystackStatus('failed')).toBe('failed');
    expect(mapPaystackStatus('reversed')).toBe('failed');
    expect(mapPaystackStatus('abandoned')).toBe('abandoned');
    expect(mapPaystackStatus('ongoing')).toBe('pending');
    expect(mapPaystackStatus(undefined)).toBe('pending');
  });
});
