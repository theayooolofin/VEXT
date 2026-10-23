import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getDb, schema } from '@/db';
import { json } from '@/lib/http';
import { loadLessonForRequest } from '@/lib/lessonRoute';
import { startLesson } from '@/lib/lessons';
import { rollSession } from '@/lib/request';

export async function GET(req: NextRequest, ctx: { params: Promise<{ n: string }> }) {
  const { n } = await ctx.params;
  const r = await loadLessonForRequest(req, n, false);
  if (!r.ok) {
    r.res.headers.set('Cache-Control', 'private, no-store');
    return r.res;
  }
  const { lesson, unlockedAt } = r.decision;
  const studentId = r.session.student.id;
  await startLesson(studentId, r.day, lesson.version);

  // Earlier attempts let the player continue a day and number retries correctly.
  const db = await getDb();
  const attempts = await db
    .select({
      questionId: schema.questionAttempts.questionId,
      attemptNo: schema.questionAttempts.attemptNo,
      selectedOption: schema.questionAttempts.selectedOption,
    })
    .from(schema.questionAttempts)
    .where(and(eq(schema.questionAttempts.studentId, studentId), eq(schema.questionAttempts.day, r.day)));
  const progress = await db.query.lessonProgress.findFirst({
    where: and(eq(schema.lessonProgress.studentId, studentId), eq(schema.lessonProgress.day, r.day)),
  });
  const maxAttempt: Record<string, number> = {};
  for (const a of attempts) maxAttempt[a.questionId] = Math.max(maxAttempt[a.questionId] ?? 0, a.attemptNo);

  const res = json(
    {
      lesson,
      unlockedAt,
      serverTime: new Date(),
      progress: {
        completed: Boolean(progress?.completedAt),
        score: progress?.score ?? null,
        maxAttempt,
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
  return rollSession(r.session, req, res);
}
