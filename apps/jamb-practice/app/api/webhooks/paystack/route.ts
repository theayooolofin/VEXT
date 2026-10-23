import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { logServer } from '@/lib/events';
import { getPaymentProvider } from '@/lib/payments';
import { settleOrder } from '@/lib/payments/settle';

// Paystack posts here. The signature is checked over the raw body before
// anything is parsed or trusted. Valid duplicates always get 200.
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 100_000) return new Response('Too large', { status: 413 });
  const provider = getPaymentProvider();
  const parsed = provider.parseWebhook(raw, req.headers);
  const db = await getDb();

  if (!parsed.valid) {
    logServer('warn', 'webhook signature invalid', { type: parsed.type });
    await db
      .insert(schema.paymentEvents)
      .values({
        provider: provider.name,
        // Invalid events are logged for the admin alert but never deduplicated against real ones.
        eventKey: `invalid:${crypto.randomUUID()}`,
        type: parsed.type.slice(0, 60),
        reference: null,
        signatureValid: false,
        payload: null,
        processedAt: new Date(),
        result: 'rejected',
      });
    return Response.json({ error: { code: 'SIGNATURE_INVALID', message: 'Invalid signature.' } }, { status: 401 });
  }

  const inserted = await db
    .insert(schema.paymentEvents)
    .values({
      provider: provider.name,
      eventKey: parsed.eventKey,
      type: parsed.type,
      reference: parsed.reference ?? null,
      signatureValid: true,
      payload: parsed.redacted ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: schema.paymentEvents.id });
  if (!inserted.length) return Response.json({ ok: true, duplicate: true });

  let result = 'ignored';
  if (parsed.type === 'charge.success' && parsed.reference) {
    try {
      const r = await settleOrder(parsed.reference, { source: 'webhook' });
      result = r.outcome;
    } catch (e) {
      // Let the provider retry: drop our record so the retry is processed.
      logServer('error', 'webhook settle failed', { reference: parsed.reference, message: (e as Error).message });
      await db.delete(schema.paymentEvents).where(eq(schema.paymentEvents.id, inserted[0]!.id));
      return Response.json({ error: { code: 'SERVER_ERROR', message: 'Try again.' } }, { status: 500 });
    }
  }
  await db
    .update(schema.paymentEvents)
    .set({ processedAt: new Date(), result })
    .where(and(eq(schema.paymentEvents.id, inserted[0]!.id)));
  return Response.json({ ok: true });
}
