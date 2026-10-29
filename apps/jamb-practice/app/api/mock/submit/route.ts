import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, json, parseBody } from '@/lib/http';
import { submitMock } from '@/lib/mockRepo';
import { hit, LIMITS } from '@/lib/rateLimit';
import { requireStudent } from '@/lib/request';

const body = z.object({
  attemptId: z.uuid(),
  answers: z.record(z.string().max(20), z.enum(['A', 'B', 'C', 'D'])),
});

/** Marks a mock on the server. The answers and explanations are sent back only now. */
export async function POST(req: NextRequest) {
  const g = await requireStudent(req, { mutation: true });
  if (!g.ok) return g.res;
  if (!(await hit(LIMITS.mock, g.session.student.id))) return apiError('RATE_LIMITED', 429);
  const p = await parseBody(req, body);
  if (!p.ok) return p.res;
  const r = await submitMock(g.session.student.id, p.data.attemptId, p.data.answers);
  if (!r.ok) {
    if (r.reason === 'ALREADY_SUBMITTED') return apiError('MOCK_SUBMITTED', 409);
    return apiError('VALIDATION_FAILED', 404, undefined, 'We could not find that mock.');
  }
  return json(r.result, { headers: { 'Cache-Control': 'private, no-store' } });
}
