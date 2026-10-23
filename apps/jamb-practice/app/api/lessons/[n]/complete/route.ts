import type { NextRequest } from 'next/server';
import { apiError, json } from '@/lib/http';
import { loadLessonForRequest } from '@/lib/lessonRoute';
import { completeLesson } from '@/lib/lessons';

export async function POST(req: NextRequest, ctx: { params: Promise<{ n: string }> }) {
  const { n } = await ctx.params;
  const r = await loadLessonForRequest(req, n, true);
  if (!r.ok) return r.res;
  const done = await completeLesson(r.session.student.id, r.decision.lesson);
  if (!done.ok)
    return apiError('VALIDATION_FAILED', 409, { missing: done.missing }, `Answer all ${r.decision.lesson.questions.length} questions first.`);
  return json({ score: done.score, total: r.decision.lesson.questions.length, firstTime: done.firstTime });
}
