import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import { ANON_COOKIE, ATTR_COOKIE, decodeAttribution, isValidAnonId } from './attribution';
import { hashIp } from './crypto';
import { apiError, checkCsrf, checkOrigin, clientIp, userAgentClass } from './http';
import { getSessionByToken, SESSION_COOKIE, setSessionCookie, touchSession, type CurrentSession } from './session';

export function requestMeta(req: NextRequest) {
  const anon = req.cookies.get(ANON_COOKIE)?.value;
  return {
    anonId: isValidAnonId(anon) ? anon : null,
    attribution: decodeAttribution(req.cookies.get(ATTR_COOKIE)?.value),
    userAgentClass: userAgentClass(req.headers.get('user-agent')),
    ipHash: hashIp(clientIp(req)),
  };
}

type Guard = { ok: true; session: CurrentSession } | { ok: false; res: NextResponse };

/**
 * Loads the signed-in student. For state-changing requests it also checks the
 * Origin header and the per-session CSRF token.
 */
export async function requireStudent(req: NextRequest, opts: { mutation: boolean }): Promise<Guard> {
  if (opts.mutation && !checkOrigin(req)) return { ok: false, res: apiError('FORBIDDEN', 403) };
  const session = await getSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return { ok: false, res: apiError('NOT_SIGNED_IN', 401) };
  if (opts.mutation && !checkCsrf(req, session.tokenHash)) return { ok: false, res: apiError('FORBIDDEN', 403) };
  return { ok: true, session };
}

/** Re-sends the session cookie when its rolling expiry moved. */
export async function rollSession(session: CurrentSession, req: NextRequest, res: NextResponse) {
  const fresh = await touchSession(session);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (fresh && token) setSessionCookie(res, token, fresh);
  return res;
}
