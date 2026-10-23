import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { requireStudent } from '@/lib/request';
import { clearSessionCookie, revokeSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const g = await requireStudent(req, { mutation: true });
  if (!g.ok) {
    // Already signed out: still clear the cookie.
    const res = json({ ok: true });
    clearSessionCookie(res);
    return res;
  }
  await revokeSession(g.session.sessionId);
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
}
