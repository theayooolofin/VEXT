import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from './env';
import { keyedHash, safeEqual } from './crypto';
import { PHONE_ERROR } from './phone';

export const ERROR_MESSAGES = {
  PHONE_INVALID: PHONE_ERROR,
  PHONE_EXISTS: 'This number already has an account. Use your recovery code to sign back in.',
  NAME_INVALID: 'Enter your first name (2 to 40 letters).',
  CONSENT_REQUIRED: 'Tick the box to confirm you agree before you continue.',
  RATE_LIMITED: 'Too many tries. Wait a little and try again.',
  NOT_SIGNED_IN: 'Sign in to continue.',
  NEEDS_PAYMENT: 'Pay to unlock Days 4 to 14.',
  NOT_YET: 'This day is not open yet.',
  CONTENT_NOT_READY: "Today's lesson is being checked by our teacher and will appear shortly.",
  EXPIRED: 'Your access to this pack has ended.',
  MOCK_NOT_READY: 'The timed mock opens once Day 2 is open, so it has enough questions.',
  MOCK_SUBMITTED: 'This mock has already been marked.',
  ENROLMENT_CLOSED:
    'Enrolment is closed for now. Message us on WhatsApp to be told when the next group opens.',
  ALREADY_ENROLLED: 'You already have the full pack. Open your lessons to continue.',
  ORDER_NOT_FOUND: 'We could not find that order.',
  PAYMENT_PENDING:
    'We are confirming your payment. This usually takes under a minute. Please do not pay again.',
  PAYMENT_FAILED:
    'Your payment did not go through. You have not been charged. Try again or use another payment method.',
  SIGNATURE_INVALID: 'Invalid signature.',
  RECOVERY_FAILED: 'That phone number and recovery code do not match. Check both and try again.',
  VALIDATION_FAILED: 'Some details are missing or not in the right format. Check and try again.',
  FORBIDDEN: 'This request was blocked. Reload the page and try again.',
  EMAIL_REQUIRED: 'Enter an email address for your payment receipt.',
  SERVER_ERROR: 'Something went wrong on our side. Try again in a minute.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export function apiError(
  code: ErrorCode,
  status: number,
  extra?: Record<string, unknown>,
  message?: string,
) {
  return NextResponse.json(
    { error: { code, message: message ?? ERROR_MESSAGES[code] }, ...extra },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export function json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': 'no-store', ...init?.headers },
  });
}

/** Parses a JSON body with zod. Returns the data or a ready-made 400 response. */
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: NextResponse }> {
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 20_000) return { ok: false, res: apiError('VALIDATION_FAILED', 413) };
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, res: apiError('VALIDATION_FAILED', 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: apiError('VALIDATION_FAILED', 400) };
  return { ok: true, data: parsed.data };
}

export function appOrigin(): string {
  return new URL(env().APP_BASE_URL).origin;
}

/** Absolute URL inside the product, built from configuration, never from request headers. */
export function absoluteUrl(pathInApp: string): string {
  return `${appOrigin()}${env().BASE_PATH}${pathInApp.startsWith('/') ? '' : '/'}${pathInApp}`;
}

/** State-changing requests must come from our own pages. */
export function checkOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (origin) return origin === appOrigin();
  return req.headers.get('sec-fetch-site') === 'same-origin';
}

export function csrfTokenFor(sessionTokenHash: string): string {
  return keyedHash(sessionTokenHash, 'csrf').slice(0, 40);
}

export function checkCsrf(req: Request, sessionTokenHash: string): boolean {
  const sent = req.headers.get('x-csrf-token') ?? '';
  return sent.length > 0 && safeEqual(sent, csrfTokenFor(sessionTokenHash));
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip');
}

export function userAgentClass(ua: string | null): 'android' | 'ios' | 'desktop' | 'other' {
  if (!ua) return 'other';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/windows|macintosh|linux|cros/i.test(ua)) return 'desktop';
  return 'other';
}

export function cookieBase() {
  return {
    path: env().BASE_PATH,
    secure: true,
    sameSite: 'lax' as const,
  };
}

export type AnyRequest = NextRequest;
