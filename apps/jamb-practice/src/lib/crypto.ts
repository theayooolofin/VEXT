import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from './env';

// No 0/O, 1/I/L: easy to read aloud and type on a phone.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomCode(length: number, alphabet = CODE_ALPHABET): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Keyed hash for secrets we must look up later (session tokens, recovery codes). */
export function keyedHash(value: string, purpose: string): string {
  return createHmac('sha256', env().SESSION_SECRET).update(`${purpose}:${value}`).digest('hex');
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${env().IP_HASH_SALT}:${ip}`).digest('hex').slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** HMAC-signed JSON for small cookies (jp_attr, jp_admin). */
export function signValue(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', env().SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySigned<T>(value: string | undefined | null): T | null {
  if (!value) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', env().SESSION_SECRET).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

/** Recovery codes: 12 characters shown as XXXX-XXXX-XXXX. */
export function newRecoveryCode(): string {
  const c = randomCode(12);
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}

/** Accepts any case, ignores hyphens and spaces. */
export function canonicalRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function orderReference(): string {
  return `JP-${randomCode(12)}`;
}
