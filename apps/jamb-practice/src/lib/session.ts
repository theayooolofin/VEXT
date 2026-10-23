import 'server-only';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { NextResponse } from 'next/server';
import { getDb, schema, type Tx } from '@/db';
import { canonicalRecoveryCode, keyedHash, newRecoveryCode, randomToken } from './crypto';
import { cookieBase } from './http';

// Sign-in is phone number plus recovery code. SMS verification could be added
// behind these functions later; it is out of scope for v1 (spec 7.4).

export const SESSION_COOKIE = 'jp_session';
export const SESSION_DAYS = 90;
const DAY_MS = 86_400_000;

export type CurrentSession = {
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
  student: typeof schema.students.$inferSelect;
};

export const hashSessionToken = (token: string) => keyedHash(token, 'session');
export const hashRecoveryCode = (code: string) => keyedHash(canonicalRecoveryCode(code), 'recovery');

export async function createSession(
  tx: Tx,
  studentId: string,
  meta: { userAgentClass: string; ipHash: string | null },
  now = new Date(),
) {
  const token = randomToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
  await tx.insert(schema.sessions).values({
    studentId,
    tokenHash,
    expiresAt,
    userAgentClass: meta.userAgentClass,
    ipHash: meta.ipHash,
  });
  return { token, tokenHash, expiresAt };
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set(SESSION_COOKIE, token, { ...cookieBase(), httpOnly: true, expires: expiresAt });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { ...cookieBase(), httpOnly: true, maxAge: 0 });
}

export async function getSessionByToken(
  token: string | undefined | null,
  now = new Date(),
): Promise<CurrentSession | null> {
  if (!token || token.length > 100) return null;
  const db = await getDb();
  const tokenHash = hashSessionToken(token);
  const rows = await db
    .select({ session: schema.sessions, student: schema.students })
    .from(schema.sessions)
    .innerJoin(schema.students, eq(schema.students.id, schema.sessions.studentId))
    .where(
      and(
        eq(schema.sessions.tokenHash, tokenHash),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, now),
        isNull(schema.students.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    sessionId: row.session.id,
    tokenHash,
    expiresAt: row.session.expiresAt,
    student: row.student,
  };
}

/**
 * Rolling expiry: extends the session at most once a day. Returns the new
 * expiry when the cookie should be re-sent.
 */
export async function touchSession(s: CurrentSession, now = new Date()): Promise<Date | null> {
  const fresh = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
  if (fresh.getTime() - s.expiresAt.getTime() < DAY_MS) return null;
  const db = await getDb();
  await db.update(schema.sessions).set({ expiresAt: fresh }).where(eq(schema.sessions.id, s.sessionId));
  await db.update(schema.students).set({ lastSeenAt: now }).where(eq(schema.students.id, s.student.id));
  return fresh;
}

export async function revokeSession(sessionId: string) {
  const db = await getDb();
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(eq(schema.sessions.id, sessionId));
}

/** Replaces any active recovery code with a new one and returns it (shown once). */
export async function issueRecoveryCode(tx: Tx, studentId: string, now = new Date()) {
  await tx
    .update(schema.recoveryCodes)
    .set({ replacedAt: now })
    .where(
      and(
        eq(schema.recoveryCodes.studentId, studentId),
        isNull(schema.recoveryCodes.usedAt),
        isNull(schema.recoveryCodes.replacedAt),
      ),
    );
  const code = newRecoveryCode();
  await tx.insert(schema.recoveryCodes).values({ studentId, codeHash: hashRecoveryCode(code) });
  return code;
}
