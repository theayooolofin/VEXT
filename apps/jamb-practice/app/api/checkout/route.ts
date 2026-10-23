import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { startCheckout } from '@/lib/checkout';
import { apiError, ERROR_MESSAGES, json, parseBody } from '@/lib/http';
import { hit, LIMITS } from '@/lib/rateLimit';
import { requireStudent } from '@/lib/request';
import { getSettings } from '@/lib/settingsRepo';

const body = z.object({
  sku: z.literal('core-14'),
  email: z.email().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const g = await requireStudent(req, { mutation: true });
  if (!g.ok) return g.res;
  if (!(await hit(LIMITS.checkout, g.session.student.id))) return apiError('RATE_LIMITED', 429);
  const p = await parseBody(req, body);
  if (!p.ok) return p.res;
  const r = await startCheckout(g.session.student, await getSettings(), { email: p.data.email?.toLowerCase() });
  if (!r.ok) {
    const status = { ENROLMENT_CLOSED: 409, ALREADY_ENROLLED: 409, EMAIL_REQUIRED: 400, SERVER_ERROR: 502 }[r.code];
    const msg = r.code === 'SERVER_ERROR' ? 'We could not start the payment. Try again in a minute.' : ERROR_MESSAGES[r.code];
    return apiError(r.code, status, undefined, msg);
  }
  return json({ orderReference: r.reference, paymentUrl: r.paymentUrl });
}
