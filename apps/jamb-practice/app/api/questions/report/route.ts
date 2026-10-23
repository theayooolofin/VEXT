import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { getContent, servableDiagnostic } from '@/lib/content';
import { recordEvent } from '@/lib/events';
import { apiError, json, parseBody } from '@/lib/http';
import { hit, LIMITS } from '@/lib/rateLimit';
import { requireStudent } from '@/lib/request';

const body = z.object({
  day: z.number().int().min(0).max(14), // 0 = diagnostic
  questionId: z.string().max(20),
  reason: z.enum(['answer_seems_wrong', 'question_unclear', 'typo', 'other']),
  message: z.string().max(300).optional().default(''),
});

export async function POST(req: NextRequest) {
  const g = await requireStudent(req, { mutation: true });
  if (!g.ok) return g.res;
  if (!(await hit(LIMITS.report, g.session.student.id))) return apiError('RATE_LIMITED', 429);
  const p = await parseBody(req, body);
  if (!p.ok) return p.res;
  const { day, questionId, reason, message } = p.data;

  const source = day === 0 ? servableDiagnostic() : getContent().lessons.get(day)?.data;
  if (!source?.questions.some((q) => q.id === questionId))
    return apiError('VALIDATION_FAILED', 400, undefined, 'We could not find that question.');

  const db = await getDb();
  await db.insert(schema.questionReports).values({
    studentId: g.session.student.id,
    day,
    questionId,
    lessonVersion: source.version,
    reason,
    message: message.trim() || null,
  });
  await recordEvent('question_reported', { day, question_id: questionId, reason }, { studentId: g.session.student.id });
  return json({ ok: true, message: 'Thank you. A teacher will check it.' }, { status: 201 });
}
