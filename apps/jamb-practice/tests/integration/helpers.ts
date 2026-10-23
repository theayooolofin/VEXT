import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema, setDbForTests } from '@/db';
import { seed } from '@/db/seedData';
import { csrfTokenFor } from '@/lib/http';
import { setPaymentProviderForTests } from '@/lib/payments';
import { hashSessionToken } from '@/lib/session';
import { lagosDateTime } from '@/lib/time';

export const ORIGIN = 'https://vextglobal.test';
export const BASE = `${ORIGIN}/jamb-practice`;

/** A fresh, migrated, seeded in-memory Postgres for one test file. */
export async function freshDb() {
  setDbForTests(undefined);
  setPaymentProviderForTests(undefined);
  const db = await getDb();
  await seed(db);
  // Keep enrolment open for "now" so checkout tests do not depend on today's date.
  await db
    .update(schema.cohorts)
    .set({ enrollmentOpensAt: new Date(Date.now() - 86_400_000), enrollmentClosesAt: new Date(Date.now() + 7 * 86_400_000) });
  return db;
}

export type Client = { cookies: Map<string, string>; csrf?: string };

export function client(): Client {
  return { cookies: new Map([['jp_anon', 'anon_test_1234567890abcd']]) };
}

export function req(
  c: Client | null,
  method: string,
  path: string,
  body?: unknown,
  opts: { origin?: string | null; headers?: Record<string, string>; raw?: string } = {},
) {
  const headers = new Headers(opts.headers);
  if (opts.origin !== null) headers.set('origin', opts.origin ?? ORIGIN);
  if (c) {
    headers.set('cookie', [...c.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    if (c.csrf) headers.set('x-csrf-token', c.csrf);
  }
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(`${BASE}${path}`, {
    method,
    headers,
    body: opts.raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
}

/** Stores Set-Cookie values from a response and refreshes the CSRF token. */
export function absorb(c: Client, res: Response) {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const i = pair!.indexOf('=');
    const name = pair!.slice(0, i);
    const value = pair!.slice(i + 1);
    if (/max-age=0/i.test(line) || value === '') c.cookies.delete(name);
    else c.cookies.set(name, value);
  }
  const token = c.cookies.get('jp_session');
  c.csrf = token ? csrfTokenFor(hashSessionToken(decodeURIComponent(token))) : undefined;
  return res;
}

let phoneSeq = 1000000;
export function nextPhone() {
  phoneSeq++;
  return `0803${String(phoneSeq).slice(-7)}`;
}

export async function signUp(c: Client, overrides: Record<string, unknown> = {}) {
  const { POST } = await import('../../app/api/signup/route');
  const res = await POST(
    req(c, 'POST', '/api/signup', {
      firstName: 'Ada',
      phone: nextPhone(),
      classLevel: 'ss3',
      email: '',
      guardianConsent: true,
      ...overrides,
    }),
  );
  absorb(c, res);
  return res;
}

export async function studentIdOf(c: Client) {
  const db = await getDb();
  const token = decodeURIComponent(c.cookies.get('jp_session')!);
  const s = await db.query.sessions.findFirst({ where: eq(schema.sessions.tokenHash, hashSessionToken(token)) });
  return s!.studentId;
}

/** Moves a student's signup back in time so free days have unlocked. */
export async function ageStudent(studentId: string, days: number) {
  const db = await getDb();
  await db
    .update(schema.students)
    .set({ createdAt: new Date(Date.now() - days * 86_400_000) })
    .where(eq(schema.students.id, studentId));
}

/** Puts the cohort start in the past so paid days have unlocked. */
export async function startCohortDaysAgo(days: number) {
  const db = await getDb();
  const d = new Date(Date.now() - days * 86_400_000 + 3600_000);
  const date = new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);
  await db.update(schema.cohorts).set({ startDate: date });
  return lagosDateTime(date, '18:00');
}
