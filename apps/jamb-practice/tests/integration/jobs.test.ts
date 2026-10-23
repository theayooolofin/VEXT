import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb, schema } from '@/db';
import { inQuietHours, runHousekeeping, runReminders, setPushSenderForTests } from '@/lib/jobs';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { lagosDateTime, toLagosDate, addDays } from '@/lib/time';
import { fakeSetOutcome } from '@/lib/payments/fake';
import { client, freshDb, req, signUp, studentIdOf } from './helpers';
import { POST as checkout } from '../../app/api/checkout/route';
import { GET as reminders } from '../../app/api/cron/reminders/route';

beforeAll(async () => {
  await freshDb();
});

async function studentWithSub(createdAt: Date, endpoint: string) {
  const c = client();
  await signUp(c);
  const id = await studentIdOf(c);
  const db = await getDb();
  await db.update(schema.students).set({ createdAt }).where(eq(schema.students.id, id));
  await db.insert(schema.pushSubscriptions).values({ studentId: id, endpoint, p256dh: 'k', auth: 'a' });
  return { c, id };
}

describe('push reminders', () => {
  it('respects quiet hours (21:00 to 06:00 Lagos)', () => {
    expect(inQuietHours(lagosDateTime('2026-11-16', '21:00'))).toBe(true);
    expect(inQuietHours(lagosDateTime('2026-11-16', '05:59'))).toBe(true);
    expect(inQuietHours(lagosDateTime('2026-11-16', '06:00'))).toBe(false);
    expect(inQuietHours(lagosDateTime('2026-11-16', '18:00'))).toBe(false);
  });

  it('sends one push for the day that opened today, and never twice', async () => {
    // Signed up yesterday (Lagos): Day 2 opens today at 18:00.
    const now = new Date();
    const today = toLagosDate(now);
    const at = lagosDateTime(today, '18:05');
    const { id } = await studentWithSub(lagosDateTime(addDays(today, -1), '10:00'), 'https://push.example/one');
    const sent: string[] = [];
    setPushSenderForTests(async (sub, payload) => {
      sent.push(`${sub.endpoint} ${payload}`);
      return { statusCode: 201 };
    });
    const r1 = await runReminders(DEFAULT_SETTINGS, at);
    expect(r1.sent).toBe(1);
    expect(sent[0]).toContain('"title":"Day 2 is ready"');
    expect(sent[0]).toContain('/jamb-practice/learn/day/2');
    const r2 = await runReminders(DEFAULT_SETTINGS, new Date(at.getTime() + 60_000));
    expect(r2.sent).toBe(0);
    expect(sent).toHaveLength(1);
    const db = await getDb();
    const log = await db.select().from(schema.reminderLog).where(eq(schema.reminderLog.studentId, id));
    expect(log).toHaveLength(1);
  });

  it('revokes a subscription on 410 Gone', async () => {
    const today = toLagosDate(new Date());
    const { id } = await studentWithSub(lagosDateTime(addDays(today, -1), '11:00'), 'https://push.example/gone');
    setPushSenderForTests(async () => ({ statusCode: 410 }));
    await runReminders(DEFAULT_SETTINGS, lagosDateTime(today, '18:10'));
    const db = await getDb();
    const sub = await db.query.pushSubscriptions.findFirst({ where: eq(schema.pushSubscriptions.studentId, id) });
    expect(sub!.revokedAt).not.toBeNull();
    setPushSenderForTests(undefined);
  });

  it('the cron endpoint needs the bearer secret', async () => {
    const no = await reminders(new Request('https://x/api/cron/reminders'));
    expect(no.status).toBe(401);
    const yes = await reminders(new Request('https://x/api/cron/reminders', { headers: { authorization: 'Bearer test-cron-secret-123456' } }));
    expect(yes.status).toBe(200);
  });
});

describe('housekeeping', () => {
  it('settles a stale order the provider says is paid, and abandons one unpaid after 24 hours', async () => {
    const db = await getDb();
    const a = client();
    await signUp(a);
    const ra = await (await checkout(req(a, 'POST', '/api/checkout', { sku: 'core-14' }))).json();
    const b = client();
    await signUp(b);
    const rb = await (await checkout(req(b, 'POST', '/api/checkout', { sku: 'core-14' }))).json();
    fakeSetOutcome(ra.orderReference, 'success');
    await db.update(schema.orders).set({ createdAt: new Date(Date.now() - 40 * 60_000) }).where(eq(schema.orders.reference, ra.orderReference));
    await db.update(schema.orders).set({ createdAt: new Date(Date.now() - 25 * 3600_000) }).where(eq(schema.orders.reference, rb.orderReference));
    const out = await runHousekeeping();
    expect(out.settled).toBe(1);
    expect(out.abandoned).toBe(1);
    const oa = await db.query.orders.findFirst({ where: eq(schema.orders.reference, ra.orderReference) });
    const ob = await db.query.orders.findFirst({ where: eq(schema.orders.reference, rb.orderReference) });
    expect(oa!.status).toBe('paid');
    expect(ob!.status).toBe('abandoned');
  });
});
