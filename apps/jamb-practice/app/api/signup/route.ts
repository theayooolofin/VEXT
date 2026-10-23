import type { NextRequest } from 'next/server';
import { recordEvent } from '@/lib/events';
import { apiError, checkOrigin, ERROR_MESSAGES, json, parseBody } from '@/lib/http';
import { hit, LIMITS } from '@/lib/rateLimit';
import { requestMeta } from '@/lib/request';
import { setSessionCookie } from '@/lib/session';
import { signup, signupSchema } from '@/lib/students';
import { env } from '@/lib/env';

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return apiError('FORBIDDEN', 403);
  const meta = requestMeta(req);
  if (!(await hit(LIMITS.signup, meta.ipHash))) return apiError('RATE_LIMITED', 429);
  const p = await parseBody(req, signupSchema);
  if (!p.ok) return p.res;

  const result = await signup(p.data, meta);
  if (!result.ok) {
    await recordEvent('signup_failed', { reason: result.code }, { anonId: meta.anonId, attribution: meta.attribution, userAgentClass: meta.userAgentClass });
    const status = result.code === 'PHONE_EXISTS' ? 409 : 400;
    return apiError(result.code, status, undefined, ERROR_MESSAGES[result.code]);
  }
  const res = json(
    {
      student: { id: result.studentId, firstName: result.firstName },
      recoveryCode: result.recoveryCode,
      next: `${env().BASE_PATH}/start/done`,
    },
    { status: 201 },
  );
  setSessionCookie(res, result.token, result.expiresAt);
  return res;
}
