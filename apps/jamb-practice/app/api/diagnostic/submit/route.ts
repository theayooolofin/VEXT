import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { servableDiagnostic } from '@/lib/content';
import { scoreDiagnostic } from '@/lib/diagnostic';
import { recordEvent } from '@/lib/events';
import { apiError, checkOrigin, json, parseBody } from '@/lib/http';
import { hit, LIMITS } from '@/lib/rateLimit';
import { requestMeta } from '@/lib/request';
import { getSessionByToken, SESSION_COOKIE } from '@/lib/session';

const body = z.object({
  answers: z.record(z.string().max(20), z.enum(['A', 'B', 'C', 'D'])),
  startedAt: z.iso.datetime().optional(),
});

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return apiError('FORBIDDEN', 403);
  const meta = requestMeta(req);
  if (!meta.anonId) return apiError('VALIDATION_FAILED', 400, undefined, 'Reload the page and try again.');
  if (!(await hit(LIMITS.diagnostic, meta.anonId)) || !(await hit(LIMITS.diagnostic, meta.ipHash)))
    return apiError('RATE_LIMITED', 429);
  const p = await parseBody(req, body);
  if (!p.ok) return p.res;

  const diag = servableDiagnostic();
  if (!diag) return apiError('CONTENT_NOT_READY', 503);
  const answers = Object.fromEntries(
    Object.entries(p.data.answers).filter(([id]) => diag.questions.some((q) => q.id === id)),
  );
  // Score from the server's own copy; the browser's result is only for display.
  const result = scoreDiagnostic(diag, answers);
  const session = await getSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
  const db = await getDb();
  await db.insert(schema.diagnosticAttempts).values({
    anonId: meta.anonId,
    studentId: session?.student.id ?? null,
    startedAt: p.data.startedAt ? new Date(p.data.startedAt) : null,
    completedAt: new Date(),
    score: result.score,
    answers,
    topicScores: result.topicScores,
    weakestTopic: result.weakestTopic,
    contentVersion: diag.version,
    firstTouch: meta.attribution ?? {},
  });
  await recordEvent(
    'diagnostic_completed',
    { score: result.score, weakest_topic: result.weakestTopic },
    { anonId: meta.anonId, studentId: session?.student.id, attribution: meta.attribution, userAgentClass: meta.userAgentClass, path: '/check' },
  );
  return json(result);
}
