import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, json, parseBody } from '@/lib/http';
import { loadLessonForRequest } from '@/lib/lessonRoute';
import { saveAnswer } from '@/lib/lessons';
import { hit, LIMITS } from '@/lib/rateLimit';

const body = z.object({
  questionId: z.string().max(20),
  selectedOption: z.enum(['A', 'B', 'C', 'D']),
  timeMs: z.number().int().min(0).max(86_400_000).optional(),
  clientId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  attemptNo: z.number().int().min(1).max(50),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ n: string }> }) {
  const { n } = await ctx.params;
  const r = await loadLessonForRequest(req, n, true);
  if (!r.ok) return r.res;
  if (!(await hit(LIMITS.answer, r.session.student.id))) return apiError('RATE_LIMITED', 429);
  const p = await parseBody(req, body);
  if (!p.ok) return p.res;
  const saved = await saveAnswer(r.session.student.id, r.decision.lesson, p.data);
  if (!saved) return apiError('VALIDATION_FAILED', 400, undefined, 'That question is not part of this lesson.');
  return json(saved);
}
