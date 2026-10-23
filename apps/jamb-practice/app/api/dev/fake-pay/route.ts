import type { NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { checkOrigin } from '@/lib/http';
import { fakeGet, fakeSetOutcome, fakeWebhook } from '@/lib/payments/fake';

// Test checkout for the fake provider. Unreachable unless PAYMENT_PROVIDER=fake.
export async function POST(req: NextRequest) {
  if (env().PAYMENT_PROVIDER !== 'fake' || !checkOrigin(req)) return new Response('Not found', { status: 404 });
  const form = await req.formData();
  const reference = String(form.get('reference') ?? '');
  const outcome = String(form.get('outcome') ?? '');
  const tx = fakeGet(reference);
  if (!tx) return new Response('Unknown reference', { status: 404 });
  fakeSetOutcome(reference, outcome === 'success' ? 'success' : 'failed');
  if (outcome === 'success' && form.get('webhook') === '1') {
    // Deliver a signed webhook to ourselves, as Paystack would.
    const { body, signature } = fakeWebhook(reference);
    await fetch(new URL(`${env().BASE_PATH}/api/webhooks/paystack`, req.nextUrl.origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-paystack-signature': signature },
      body,
    });
  }
  return Response.redirect(tx.callbackUrl, 303);
}
