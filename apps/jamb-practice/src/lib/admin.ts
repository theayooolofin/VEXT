import 'server-only';
import bcrypt from 'bcryptjs';
import { getDb, schema } from '@/db';
import { randomToken, signValue, verifySigned } from './crypto';
import { env } from './env';

export const ADMIN_COOKIE = 'jp_admin';
export const ADMIN_TTL_MS = 2 * 60 * 60 * 1000;

type AdminClaims = { exp: number; nonce: string };

/**
 * The bcrypt hash, given either as is or base64url-encoded. The encoded form
 * has no "$", which .env loaders would otherwise try to expand.
 */
export function adminHash(raw = env().ADMIN_PASSWORD_HASH): string {
  return raw.startsWith('$2') ? raw : Buffer.from(raw, 'base64url').toString('utf8');
}

export async function checkAdminPassword(password: string): Promise<boolean> {
  if (!password || password.length > 200) return false;
  try {
    return await bcrypt.compare(password, adminHash());
  } catch {
    return false;
  }
}

export function newAdminCookie(now = Date.now()) {
  const claims: AdminClaims = { exp: now + ADMIN_TTL_MS, nonce: randomToken(12) };
  return { value: signValue(claims), expires: new Date(claims.exp), nonce: claims.nonce };
}

export function readAdminCookie(value: string | undefined, now = Date.now()): AdminClaims | null {
  const c = verifySigned<AdminClaims>(value);
  if (!c || typeof c.exp !== 'number' || c.exp < now) return null;
  return c;
}

/** Hidden form field value; ties admin forms to the admin session. */
export function adminCsrf(claims: AdminClaims): string {
  return signValue({ n: claims.nonce }).split('.')[1]!.slice(0, 32);
}

export function adminCookieOptions() {
  return {
    path: `${env().BASE_PATH}/admin`,
    secure: true,
    httpOnly: true,
    sameSite: 'strict' as const,
  };
}

export async function audit(action: string, target: string | null, details: Record<string, unknown>, ipHash: string | null) {
  const db = await getDb();
  await db.insert(schema.adminAuditLog).values({ action, target, details, ipHash });
}
