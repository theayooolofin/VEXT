import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { apiError, checkOrigin, json, parseBody } from '@/lib/http';
import { normalizeNigerianPhone, phoneHint } from '@/lib/phone';
import { hit, LIMITS } from '@/lib/rateLimit';
import { requestMeta } from '@/lib/request';
import { getSessionByToken, SESSION_COOKIE } from '@/lib/session';

const body = z.object({
  type: z.enum(['refund', 'question', 'delete', 'recovery']),
  message: z.string().max(500).optional().default(''),
  phone: z.string().max(40).optional(),
});

/** Refund and help requests from /refunds and /contact. Signed-in or not. */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return apiError('FORBIDDEN', 403);
  const meta = requestMeta(req);
  if (!(await hit(LIMITS.report, meta.ipHash))) return apiError('RATE_LIMITED', 429);
  const p = await parseBody(req, body);
  if (!p.ok) return p.res;
  const session = await getSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
  const phone = session?.student.phoneE164 ?? (p.data.phone ? normalizeNigerianPhone(p.data.phone) : null);
  const db = await getDb();
  await db.insert(schema.supportRequests).values({
    studentId: session?.student.id ?? null,
    phoneHint: phone ? phoneHint(phone) : null,
    type: p.data.type,
    message: p.data.message.trim() || null,
  });
  return json({ ok: true }, { status: 201 });
}
