import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb, schema } from '@/db';
import { resetEnvCache } from '@/lib/env';
import { clearContentCache } from '@/lib/content';
import { fakeSetOutcome } from '@/lib/payments/fake';
import { absorb, ageStudent, client, freshDb, nextPhone, req, signUp, studentIdOf, type Client } from './helpers';
import { POST as signupRoute } from '../../app/api/signup/route';
import { POST as recoverRoute } from '../../app/api/recover/route';
import { POST as logoutRoute } from '../../app/api/logout/route';
import { POST as deleteRoute } from '../../app/api/account/delete/route';
import { POST as diagRoute } from '../../app/api/diagnostic/submit/route';
import { POST as eventsRoute } from '../../app/api/events/route';
import { POST as reportRoute } from '../../app/api/questions/report/route';
import { POST as checkoutRoute } from '../../app/api/checkout/route';
import { GET as lessonRoute } from '../../app/api/lessons/[n]/route';
import { POST as answerRoute } from '../../app/api/lessons/[n]/answer/route';
import { POST as completeRoute } from '../../app/api/lessons/[n]/complete/route';
import { GET as meRoute } from '../../app/api/me/route';
import { GET as statusRoute } from '../../app/api/orders/[reference]/status/route';

const params = (n: number) => ({ params: Promise.resolve({ n: String(n) }) });
const getLesson = (c: Client, n: number) => lessonRoute(req(c, 'GET', `/api/lessons/${n}`), params(n));
const answer = (c: Client, n: number, body: Record<string, unknown>) => answerRoute(req(c, 'POST', `/api/lessons/${n}/answer`, body), params(n));

beforeAll(async () => {
  await freshDb();
});

describe('signup', () => {
  it('creates the student, a session, a recovery code, and links the diagnostic', async () => {
    const c = client();
    const diag = await diagRoute(req(c, 'POST', '/api/diagnostic/submit', { answers: { 'dg-q01': 'B', 'dg-q02': 'A' } }));
    expect(diag.status).toBe(200);
    const result = await diag.json();
    expect(result.score).toBe(1);
    // concord is 1 of 2; tenses is 0 and comes first in topicPriority among the zeros.
    expect(result.weakestTopic).toBe('tenses');

    const res = await signUp(c, { phone: '0803 123 4567' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.recoveryCode).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(c.cookies.get('jp_session')).toBeTruthy();
    const setCookie = res.headers.getSetCookie().join('\n');
    expect(setCookie).toMatch(/jp_session=.*Path=\/jamb-practice.*HttpOnly/i);

    const db = await getDb();
    const sid = await studentIdOf(c);
    const s = await db.query.students.findFirst({ where: eq(schema.students.id, sid) });
    expect(s!.phoneE164).toBe('+2348031234567');
    const attempt = await db.query.diagnosticAttempts.findFirst({ where: eq(schema.diagnosticAttempts.studentId, sid) });
    expect(attempt?.score).toBe(1);
  });

  it('stores first-touch attribution', async () => {
    const c = client();
    const { encodeAttribution } = await import('@/lib/attribution');
    c.cookies.set('jp_attr', encodeAttribution({ utm_source: 'whatsapp', utm_campaign: 'nov' }));
    await signUp(c);
    const db = await getDb();
    const s = await db.query.students.findFirst({ where: eq(schema.students.id, await studentIdOf(c)) });
    expect(s!.firstTouch).toEqual({ utm_source: 'whatsapp', utm_campaign: 'nov' });
  });

  it('rejects a duplicate phone without revealing the account', async () => {
    const c = client();
    const res = await signUp(c, { phone: '08031234567' });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('PHONE_EXISTS');
    expect(body.error.message).toBe('This number already has an account. Use your recovery code to sign back in.');
    expect(JSON.stringify(body)).not.toContain('Ada');
  });

  it('validates name, phone and consent', async () => {
    expect((await (await signUp(client(), { phone: '12345' })).json()).error.code).toBe('PHONE_INVALID');
    expect((await (await signUp(client(), { firstName: 'A' })).json()).error.code).toBe('NAME_INVALID');
    expect((await (await signUp(client(), { guardianConsent: false })).json()).error.code).toBe('CONSENT_REQUIRED');
  });

  it('blocks a cross-origin signup', async () => {
    const res = await signupRoute(req(client(), 'POST', '/api/signup', { firstName: 'Ada', phone: nextPhone(), classLevel: 'ss3', guardianConsent: true }, { origin: 'https://evil.test' }));
    expect(res.status).toBe(403);
  });

  it('rate-limits signup with a clear 429', async () => {
    const ip = { 'x-forwarded-for': '10.9.9.9' };
    let last: Response | undefined;
    for (let i = 0; i < 31; i++) {
      last = await signupRoute(req(client(), 'POST', '/api/signup', { firstName: 'Ada', phone: nextPhone(), classLevel: 'ss3', guardianConsent: true }, { headers: ip }));
    }
    expect(last!.status).toBe(429);
    expect((await last!.json()).error).toEqual({ code: 'RATE_LIMITED', message: 'Too many tries. Wait a little and try again.' });
  });
});

describe('recovery', () => {
  it('signs back in with phone and code, then issues a new code', async () => {
    const c = client();
    const phone = nextPhone();
    const { recoveryCode } = await (await signUp(c, { phone })).json();
    await logoutRoute(req(c, 'POST', '/api/logout', {}));

    const other = client();
    const bad = await recoverRoute(req(other, 'POST', '/api/recover', { phone, code: 'AAAA-BBBB-CCCC' }));
    expect(bad.status).toBe(401);
    const ok = await recoverRoute(req(other, 'POST', '/api/recover', { phone, code: recoveryCode.toLowerCase().replace(/-/g, ' ') }));
    expect(ok.status).toBe(200);
    absorb(other, ok);
    const body = await ok.json();
    expect(body.recoveryCode).not.toBe(recoveryCode);
    // The old code is used up.
    const again = await recoverRoute(req(client(), 'POST', '/api/recover', { phone, code: recoveryCode }));
    expect(again.status).toBe(401);
    expect((await meRoute(req(other, 'GET', '/api/me'))).status).toBe(200);
  });

  it('allows 5 attempts an hour per phone', async () => {
    const phone = nextPhone();
    await signUp(client(), { phone });
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const r = await recoverRoute(req(client(), 'POST', '/api/recover', { phone, code: 'AAAA-BBBB-CCCC' }, { headers: { 'x-forwarded-for': `10.0.0.${i}` } }));
      statuses.push(r.status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });
});

describe('lesson API', () => {
  it('NOT_SIGNED_IN without a session', async () => {
    const res = await getLesson(client(), 1);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('NOT_SIGNED_IN');
  });

  it('Day 1 opens at signup; Day 2 is NOT_YET with unlocksAt', async () => {
    const c = client();
    await signUp(c);
    const res = await getLesson(c, 1);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = await res.json();
    expect(body.lesson.questions).toHaveLength(10);
    const day2 = await getLesson(c, 2);
    const j = await day2.json();
    expect(j.error.code).toBe('NOT_YET');
    expect(new Date(j.unlocksAt).toISOString()).toMatch(/T17:00:00.000Z$/);
    expect(j.error.message).toMatch(/^Day 2 opens on \w{3} \d{1,2} \w{3} at 6:00 pm\.$/);
  });

  it('NEEDS_PAYMENT for a paid day, and no lesson content in the response', async () => {
    const c = client();
    await signUp(c);
    await ageStudent(await studentIdOf(c), 10);
    const res = await getLesson(c, 4);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe('NEEDS_PAYMENT');
    expect(text).not.toContain('d04-q');
    expect(text).not.toContain('questions');
  });

  it('CONTENT_NOT_READY when unreviewed content is not allowed', async () => {
    const c = client();
    await signUp(c);
    process.env.ALLOW_UNREVIEWED_CONTENT = 'false';
    resetEnvCache();
    clearContentCache();
    try {
      const res = await getLesson(c, 1);
      expect((await res.json()).error.code).toBe('CONTENT_NOT_READY');
    } finally {
      process.env.ALLOW_UNREVIEWED_CONTENT = 'true';
      resetEnvCache();
      clearContentCache();
    }
  });

  it('EXPIRED after the entitlement has run out', async () => {
    const c = client();
    await signUp(c);
    const sid = await studentIdOf(c);
    const r = await checkoutRoute(req(c, 'POST', '/api/checkout', { sku: 'core-14' }));
    const { orderReference } = await r.json();
    fakeSetOutcome(orderReference, 'success');
    await statusRoute(req(c, 'GET', `/api/orders/${orderReference}/status`), { params: Promise.resolve({ reference: orderReference }) });
    const db = await getDb();
    await db.update(schema.entitlements).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.entitlements.studentId, sid));
    const res = await getLesson(c, 5);
    expect((await res.json()).error.code).toBe('EXPIRED');
  });

  it('marks answers on the server, is idempotent by clientId, and scores first attempts', async () => {
    const c = client();
    await signUp(c);
    const { lesson } = await (await getLesson(c, 1)).json();
    const qs = lesson.questions as { id: string; answer: string }[];

    const wrong = qs[0]!.answer === 'A' ? 'B' : 'A';
    const first = await answer(c, 1, { questionId: qs[0]!.id, selectedOption: wrong, clientId: 'client-aaaa-0001', attemptNo: 1 });
    expect(await first.json()).toEqual({ isCorrect: false, correctOption: qs[0]!.answer });
    // Same clientId again: stored once.
    await answer(c, 1, { questionId: qs[0]!.id, selectedOption: wrong, clientId: 'client-aaaa-0001', attemptNo: 1 });
    const db = await getDb();
    const sid = await studentIdOf(c);
    const rows = await db.select().from(schema.questionAttempts).where(eq(schema.questionAttempts.studentId, sid));
    expect(rows).toHaveLength(1);

    // Not complete until all ten are answered.
    expect((await completeRoute(req(c, 'POST', '/api/lessons/1/complete', {}), params(1))).status).toBe(409);
    for (const [i, q] of qs.entries()) {
      if (i === 0) continue;
      await answer(c, 1, { questionId: q.id, selectedOption: q.answer, clientId: `client-aaaa-${i + 100}`, attemptNo: 1 });
    }
    // A retry of question 1 is correct but must not change the first-attempt score.
    await answer(c, 1, { questionId: qs[0]!.id, selectedOption: qs[0]!.answer, clientId: 'client-aaaa-0999', attemptNo: 2 });
    const done = await completeRoute(req(c, 'POST', '/api/lessons/1/complete', {}), params(1));
    expect(await done.json()).toEqual({ score: 9, total: 10, firstTime: true });
    const redo = await completeRoute(req(c, 'POST', '/api/lessons/1/complete', {}), params(1));
    expect((await redo.json()).score).toBe(9);

    const me = await (await meRoute(req(c, 'GET', '/api/me'))).json();
    expect(me.days[0]).toMatchObject({ day: 1, state: 'done', score: 9 });
  });

  it('rejects an answer for a question outside the lesson', async () => {
    const c = client();
    await signUp(c);
    const res = await answer(c, 1, { questionId: 'd04-q01', selectedOption: 'A', clientId: 'client-zzzz-0001', attemptNo: 1 });
    expect(res.status).toBe(400);
  });
});

describe('reports, events and deletion', () => {
  it('saves a question report', async () => {
    const c = client();
    await signUp(c);
    const res = await reportRoute(req(c, 'POST', '/api/questions/report', { day: 1, questionId: 'd01-q01', reason: 'typo', message: 'Spelling' }));
    expect(res.status).toBe(201);
    const db = await getDb();
    const rows = await db.select().from(schema.questionReports).where(eq(schema.questionReports.questionId, 'd01-q01'));
    expect(rows[0]).toMatchObject({ reason: 'typo', status: 'open', lessonVersion: 1 });
  });

  it('accepts browser events but drops server-only ones', async () => {
    const c = client();
    const res = await eventsRoute(
      req(c, 'POST', '/api/events', { events: [{ name: 'page_view', path: '/' }, { name: 'payment_succeeded', props: { sku: 'core-14' } }] }),
    );
    expect(await res.json()).toEqual({ accepted: 1 });
  });

  it('deletes personal data and keeps orders', async () => {
    const c = client();
    await signUp(c, { email: 'ada@example.com' });
    const sid = await studentIdOf(c);
    await checkoutRoute(req(c, 'POST', '/api/checkout', { sku: 'core-14' }));
    expect((await deleteRoute(req(c, 'POST', '/api/account/delete', { confirm: 'delete' }))).status).toBe(400);
    expect((await deleteRoute(req(c, 'POST', '/api/account/delete', { confirm: 'DELETE' }))).status).toBe(200);
    const db = await getDb();
    const s = await db.query.students.findFirst({ where: eq(schema.students.id, sid) });
    expect(s).toMatchObject({ firstName: null, phoneE164: null, email: null });
    expect(s!.deletedAt).not.toBeNull();
    expect(await db.select().from(schema.orders).where(eq(schema.orders.studentId, sid))).toHaveLength(1);
    expect(await db.select().from(schema.recoveryCodes).where(eq(schema.recoveryCodes.studentId, sid))).toHaveLength(0);
    // The session no longer works.
    expect((await meRoute(req(c, 'GET', '/api/me'))).status).toBe(401);
  });
});
