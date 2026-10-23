import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getAccess, type Access } from './access';
import { getContent, servableLesson, allowUnreviewed } from './content';
import { isServable, toPublicLesson } from './contentStore';
import type { PublicLesson } from './contentSchema';
import { recordEvent } from './events';
import { ERROR_MESSAGES } from './http';
import type { Settings } from './settings';
import { formatUnlock } from './time';
import { allDayStates, dayState, type DayState } from './unlock';

type StudentLike = { id: string; createdAt: Date };

export type LessonDecision =
  | { ok: true; lesson: PublicLesson; unlockedAt: Date }
  | { ok: false; code: 'NEEDS_PAYMENT' | 'NOT_YET' | 'CONTENT_NOT_READY' | 'EXPIRED'; message: string; unlocksAt?: Date };

async function completedMap(studentId: string) {
  const db = await getDb();
  const rows = await db
    .select({ day: schema.lessonProgress.day, score: schema.lessonProgress.score })
    .from(schema.lessonProgress)
    .where(and(eq(schema.lessonProgress.studentId, studentId), sql`${schema.lessonProgress.completedAt} is not null`));
  return new Map(rows.map((r) => [r.day, r.score]));
}

function stateInput(student: StudentLike, access: Access, settings: Settings, now: Date, completed: Map<number, number | null>) {
  const content = getContent();
  const allow = allowUnreviewed();
  return {
    studentCreatedAt: student.createdAt,
    entitlement: access.active,
    hadExpiredEntitlement: access.hadExpired,
    unlockTimeLocal: settings.unlock_time_local,
    now,
    completed,
    isServable: (d: number) => {
      const item = content.lessons.get(d);
      return Boolean(item && isServable(item, allow));
    },
  };
}

export async function dashboard(student: StudentLike, settings: Settings, now = new Date()) {
  const [access, completed] = await Promise.all([getAccess(student.id, now), completedMap(student.id)]);
  const states = allDayStates(stateInput(student, access, settings, now, completed));
  const content = getContent();
  const titles = new Map<number, string>();
  for (const [day, item] of content.lessons) if (item.data) titles.set(day, item.data.title);
  return { states, access, titles };
}

/** The single gate for lesson content (spec 7.8). */
export async function decideLesson(
  student: StudentLike,
  day: number,
  settings: Settings,
  now = new Date(),
): Promise<LessonDecision> {
  const access = await getAccess(student.id, now);
  const s: DayState = dayState(day, stateInput(student, access, settings, now, new Map()));
  switch (s.state) {
    case 'needs_payment':
      return { ok: false, code: 'NEEDS_PAYMENT', message: ERROR_MESSAGES.NEEDS_PAYMENT };
    case 'expired':
      return { ok: false, code: 'EXPIRED', message: ERROR_MESSAGES.EXPIRED };
    case 'locked':
      return {
        ok: false,
        code: 'NOT_YET',
        message: `Day ${day} opens on ${formatUnlock(s.unlocksAt)}.`,
        unlocksAt: s.unlocksAt,
      };
    case 'unavailable':
      return { ok: false, code: 'CONTENT_NOT_READY', message: ERROR_MESSAGES.CONTENT_NOT_READY };
    default: {
      const lesson = servableLesson(day);
      if (!lesson) return { ok: false, code: 'CONTENT_NOT_READY', message: ERROR_MESSAGES.CONTENT_NOT_READY };
      return { ok: true, lesson: toPublicLesson(lesson, getContent().topics), unlockedAt: s.unlockedAt };
    }
  }
}

export async function startLesson(studentId: string, day: number, version: number) {
  const db = await getDb();
  await db
    .insert(schema.lessonProgress)
    .values({ studentId, day, lessonVersion: version })
    .onConflictDoNothing();
}

export type AnswerInput = {
  questionId: string;
  selectedOption: 'A' | 'B' | 'C' | 'D';
  timeMs?: number;
  clientId: string;
  attemptNo: number;
};

/** Saves one answer. Correctness comes from the server's copy, never the client. */
export async function saveAnswer(studentId: string, lesson: PublicLesson, input: AnswerInput) {
  const q = lesson.questions.find((x) => x.id === input.questionId);
  if (!q) return null;
  const isCorrect = q.answer === input.selectedOption;
  const db = await getDb();
  const inserted = await db
    .insert(schema.questionAttempts)
    .values({
      studentId,
      day: lesson.day,
      questionId: q.id,
      lessonVersion: lesson.version,
      attemptNo: input.attemptNo,
      selectedOption: input.selectedOption,
      isCorrect,
      timeMs: input.timeMs != null ? Math.min(Math.max(0, Math.round(input.timeMs)), 3_600_000) : null,
      clientId: input.clientId,
    })
    .onConflictDoNothing()
    .returning({ id: schema.questionAttempts.id });
  if (inserted.length) {
    await db
      .insert(schema.lessonProgress)
      .values({ studentId, day: lesson.day, lessonVersion: lesson.version })
      .onConflictDoNothing();
    await recordEvent('question_answered', { day: lesson.day, question_id: q.id, correct: isCorrect }, { studentId });
  }
  return { isCorrect, correctOption: q.answer };
}

/**
 * Marks a day complete once every question has an answer. The score counts
 * first attempts only; redoing a day never changes it.
 */
export async function completeLesson(studentId: string, lesson: PublicLesson) {
  const db = await getDb();
  const attempts = await db
    .select()
    .from(schema.questionAttempts)
    .where(and(eq(schema.questionAttempts.studentId, studentId), eq(schema.questionAttempts.day, lesson.day)))
    .orderBy(asc(schema.questionAttempts.attemptNo), asc(schema.questionAttempts.createdAt));
  const ids = new Set(lesson.questions.map((q) => q.id));
  const first = new Map<string, boolean>();
  for (const a of attempts) if (ids.has(a.questionId) && !first.has(a.questionId)) first.set(a.questionId, a.isCorrect);
  if (first.size < ids.size) return { ok: false as const, missing: ids.size - first.size };
  const score = [...first.values()].filter(Boolean).length;

  const existing = await db.query.lessonProgress.findFirst({
    where: and(eq(schema.lessonProgress.studentId, studentId), eq(schema.lessonProgress.day, lesson.day)),
  });
  if (existing?.completedAt) {
    await db
      .update(schema.lessonProgress)
      .set({ attemptCount: existing.attemptCount + 1 })
      .where(eq(schema.lessonProgress.id, existing.id));
    return { ok: true as const, score: existing.score ?? score, firstTime: false };
  }
  await db
    .insert(schema.lessonProgress)
    .values({ studentId, day: lesson.day, lessonVersion: lesson.version, completedAt: new Date(), score })
    .onConflictDoUpdate({
      target: [schema.lessonProgress.studentId, schema.lessonProgress.day],
      set: { completedAt: new Date(), score },
    });
  await recordEvent('lesson_completed', { day: lesson.day, score }, { studentId });
  return { ok: true as const, score, firstTime: true };
}
