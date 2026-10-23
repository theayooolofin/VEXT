import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { apiError, checkOrigin, json, parseBody } from '@/lib/http';
import { normalizeNigerianPhone } from '@/lib/phone';
import { hit, LIMITS } from '@/lib/rateLimit';
import { requestMeta } from '@/lib/request';
import { setSessionCookie } from '@/lib/session';
import { recover } from '@/lib/students';

const body = z.object({ phone: z.string().max(40), code: z.string().max(30) });

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return apiError('FORBIDDEN', 403);
  const p = await parseBody(req, body);
  if (!p.ok) return p.res;
  const meta = requestMeta(req);
  const phone = normalizeNigerianPhone(p.data.phone);
  if (!phone) return apiError('PHONE_INVALID', 400);
  // 5 tries an hour, per phone number and per IP.
  const okPhone = await hit(LIMITS.recoverPhone, phone);
  const okIp = await hit(LIMITS.recoverIp, meta.ipHash);
  if (!okPhone || !okIp) return apiError('RATE_LIMITED', 429);

  const r = await recover(phone, p.data.code, meta);
  if (!r) return apiError('RECOVERY_FAILED', 401);
  const res = json({ firstName: r.firstName, recoveryCode: r.recoveryCode, next: `${env().BASE_PATH}/start/done?recovered=1` });
  setSessionCookie(res, r.token, r.expiresAt);
  return res;
}
