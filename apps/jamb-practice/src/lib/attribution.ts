import type { FirstTouch } from '@/db/schema';
import { signValue, verifySigned } from './crypto';

export const ANON_COOKIE = 'jp_anon';
export const ATTR_COOKIE = 'jp_attr';
export const ANON_MAX_AGE = 365 * 86_400;
export const ATTR_MAX_AGE = 90 * 86_400;

const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'ref'] as const;

/** Lower-cased, limited to safe characters and 64 characters. */
export function sanitizeAttrValue(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const clean = v
    .toLowerCase()
    .replace(/[^a-z0-9_\-.]/g, '')
    .slice(0, 64);
  return clean || undefined;
}

export function attributionFromParams(params: URLSearchParams): FirstTouch | null {
  const out: FirstTouch = {};
  for (const k of KEYS) {
    const v = sanitizeAttrValue(params.get(k));
    if (v) out[k] = k === 'ref' ? v.toUpperCase() : v;
  }
  return Object.keys(out).length ? out : null;
}

export const encodeAttribution = (a: FirstTouch) => signValue(a);

export function decodeAttribution(cookie: string | undefined | null): FirstTouch | null {
  const v = verifySigned<FirstTouch>(cookie);
  if (!v || typeof v !== 'object') return null;
  const out: FirstTouch = {};
  for (const k of KEYS) {
    const s = sanitizeAttrValue(typeof v[k] === 'string' ? v[k] : undefined);
    if (s) out[k] = k === 'ref' ? s.toUpperCase() : s;
  }
  return out;
}

export function isValidAnonId(v: string | undefined | null): v is string {
  return Boolean(v && /^[A-Za-z0-9_-]{16,64}$/.test(v));
}

export function channelOf(a: FirstTouch | null | undefined): string {
  return a?.utm_source || 'direct';
}
