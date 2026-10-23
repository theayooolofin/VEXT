import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import type { FirstTouch } from '@/db/schema';
import { randomCode } from './crypto';
import { recordEvent } from './events';
import { normalizeNigerianPhone } from './phone';
import { createSession, hashRecoveryCode, issueRecoveryCode } from './session';

// LEGAL DRAFT: review before launch. Bump the version whenever the wording changes.
export const CONSENT_VERSION = 'draft-2026-10-23';
export const CONSENT_TEXT =
  'I am 18 or older, or a parent or guardian has agreed to my using this site, and I accept the Privacy Policy.';

export const signupSchema = z.object({
  firstName: z.string(),
  phone: z.string().max(40),
  classLevel: z.enum(['ss3', 'ss2_or_below', 'graduate', 'other']),
  email: z.string().max(200).optional().default(''),
  guardianConsent: z.boolean(),
});

export type SignupInput = z.infer<typeof signupSchema>;

type Meta = { anonId: string | null; attribution: FirstTouch | null; userAgentClass: string; ipHash: string | null };

export type SignupResult =
  | { ok: true; studentId: string; firstName: string; token: string; expiresAt: Date; recoveryCode: string }
  | { ok: false; code: 'NAME_INVALID' | 'PHONE_INVALID' | 'PHONE_EXISTS' | 'CONSENT_REQUIRED' | 'VALIDATION_FAILED' };

export function cleanFirstName(v: string): string | null {
  const name = v.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 40) return null;
  if (!/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(name)) return null;
  return name;
}

export async function signup(input: SignupInput, meta: Meta): Promise<SignupResult> {
  const firstName = cleanFirstName(input.firstName);
  if (!firstName) return { ok: false, code: 'NAME_INVALID' };
  const phone = normalizeNigerianPhone(input.phone);
  if (!phone) return { ok: false, code: 'PHONE_INVALID' };
  if (!input.guardianConsent) return { ok: false, code: 'CONSENT_REQUIRED' };
  const email = input.email.trim().toLowerCase();
  if (email && !z.email().safeParse(email).success) return { ok: false, code: 'VALIDATION_FAILED' };

  const db = await getDb();
  const existing = await db.query.students.findFirst({ where: eq(schema.students.phoneE164, phone) });
  if (existing) return { ok: false, code: 'PHONE_EXISTS' };

  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      const [student] = await tx
        .insert(schema.students)
        .values({
          firstName,
          phoneE164: phone,
          email: email || null,
          classLevel: input.classLevel,
          guardianConsent: true,
          consentVersion: CONSENT_VERSION,
          consentAt: now,
          referralCode: randomCode(6),
          firstTouch: meta.attribution ?? {},
          anonId: meta.anonId,
          lastSeenAt: now,
        })
        .returning();
      const s = student!;
      const session = await createSession(tx, s.id, meta, now);
      const recoveryCode = await issueRecoveryCode(tx, s.id, now);
      if (meta.anonId) {
        await tx
          .update(schema.diagnosticAttempts)
          .set({ studentId: s.id })
          .where(and(eq(schema.diagnosticAttempts.anonId, meta.anonId), isNull(schema.diagnosticAttempts.studentId)));
      }
      await recordEvent(
        'signup_completed',
        {},
        { anonId: meta.anonId, studentId: s.id, attribution: meta.attribution, userAgentClass: meta.userAgentClass },
        tx,
      );
      return {
        ok: true as const,
        studentId: s.id,
        firstName,
        token: session.token,
        expiresAt: session.expiresAt,
        recoveryCode,
      };
    });
  } catch (e) {
    // A race on the unique phone (or the rare referral-code collision).
    if (/unique|duplicate/i.test(String((e as Error).message))) {
      const again = await db.query.students.findFirst({ where: eq(schema.students.phoneE164, phone) });
      if (again) return { ok: false, code: 'PHONE_EXISTS' };
    }
    throw e;
  }
}

export async function recover(
  phoneInput: string,
  codeInput: string,
  meta: { userAgentClass: string; ipHash: string | null },
) {
  const phone = normalizeNigerianPhone(phoneInput);
  if (!phone || codeInput.length > 30) return null;
  const db = await getDb();
  const student = await db.query.students.findFirst({
    where: and(eq(schema.students.phoneE164, phone), isNull(schema.students.deletedAt)),
  });
  if (!student) return null;
  const codeHash = hashRecoveryCode(codeInput);
  return db.transaction(async (tx) => {
    const [code] = await tx
      .select()
      .from(schema.recoveryCodes)
      .where(
        and(
          eq(schema.recoveryCodes.studentId, student.id),
          eq(schema.recoveryCodes.codeHash, codeHash),
          isNull(schema.recoveryCodes.usedAt),
          isNull(schema.recoveryCodes.replacedAt),
        ),
      )
      .for('update');
    if (!code) return null;
    const now = new Date();
    await tx.update(schema.recoveryCodes).set({ usedAt: now }).where(eq(schema.recoveryCodes.id, code.id));
    const session = await createSession(tx, student.id, meta, now);
    const recoveryCode = await issueRecoveryCode(tx, student.id, now);
    return { studentId: student.id, firstName: student.firstName ?? '', ...session, recoveryCode };
  });
}

/**
 * Anonymises a student. Personal fields, sessions, codes and push
 * subscriptions go. Orders and anonymous progress stay for financial records
 * and aggregate statistics (retention rule flagged for lawyer review).
 */
export async function deleteStudent(studentId: string) {
  const db = await getDb();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.studentId, studentId));
    await tx.update(schema.sessions).set({ revokedAt: now }).where(eq(schema.sessions.studentId, studentId));
    await tx.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.studentId, studentId));
    await tx
      .update(schema.questionReports)
      .set({ message: null })
      .where(eq(schema.questionReports.studentId, studentId));
    await tx
      .update(schema.supportRequests)
      .set({ message: null, phoneHint: null })
      .where(eq(schema.supportRequests.studentId, studentId));
    await tx
      .update(schema.students)
      .set({
        firstName: null,
        phoneE164: null,
        email: null,
        anonId: null,
        firstTouch: {},
        deletedAt: now,
      })
      .where(eq(schema.students.id, studentId));
  });
}
