import 'server-only';
import { randomInt } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { OptionKey, Question } from './contentSchema';
import { getContent, servableLesson } from './content';
import { toPublicQuestion } from './contentStore';
import { recordEvent } from './events';
import { openDays } from './lessons';
import {
  MOCK_GRACE_MS,
  MOCK_MAX_QUESTIONS,
  MOCK_MIN_POOL,
  mockSeconds,
  pickMockQuestions,
  scoreMock,
  seededRandom,
  type Passage,
  type PoolItem,
} from './mock';
import type { Settings } from './settings';

type StudentLike = { id: string; createdAt: Date };

/** What the browser sees while the mock runs: no answers, no explanations. */
export type MockQuestion = {
  id: string;
  day: number;
  stem: string;
  options: Record<OptionKey, string>;
  topicTag: string;
  passageId: string | null;
};

export type ActiveMock = {
  id: string;
  questions: MockQuestion[];
  passages: Passage[];
  startedAt: Date;
  deadlineAt: Date;
};

export type MockReviewItem = MockQuestion & {
  answer: OptionKey;
  explanation: string;
  chosen: OptionKey | null;
};

export type MockResult = {
  id: string;
  score: number;
  total: number;
  answered: number;
  late: boolean;
  topicScores: Record<string, { correct: number; asked: number }>;
  weakestTopic: string | null;
  weakestDay: number | null;
  topicNames: Record<string, string>;
  review: MockReviewItem[];
  passages: Passage[];
};

/** Every question on the days this student has open, each with its passage. */
async function pool(student: StudentLike, settings: Settings, now: Date): Promise<PoolItem[]> {
  const items: PoolItem[] = [];
  for (const day of await openDays(student, settings, now)) {
    const lesson = servableLesson(day);
    if (!lesson) continue;
    for (const question of lesson.questions) {
      const passage = question.passageId
        ? lesson.passages.find((p) => p.id === question.passageId)
        : undefined;
      items.push({ question: { ...question, day }, passage });
    }
  }
  return items;
}

/** The current copy of each question, by id, from the days that can be served. */
function questionIndex() {
  const byId = new Map<string, { question: Question; day: number; passage?: Passage }>();
  for (const [day] of getContent().lessons) {
    const lesson = servableLesson(day);
    if (!lesson) continue;
    for (const question of lesson.questions) {
      const passage = question.passageId
        ? lesson.passages.find((p) => p.id === question.passageId)
        : undefined;
      byId.set(question.id, { question, day, passage });
    }
  }
  return byId;
}

function toMockQuestion(q: Question, day: number): MockQuestion {
  const p = toPublicQuestion(q);
  return {
    id: p.id,
    day,
    stem: p.stem,
    options: p.options,
    topicTag: p.topicTag,
    passageId: p.passageId,
  };
}

function uniquePassages(list: (Passage | undefined)[]): Passage[] {
  const seen = new Map<string, Passage>();
  for (const p of list) if (p && !seen.has(p.id)) seen.set(p.id, p);
  return [...seen.values()];
}

function activeFromRow(row: typeof schema.mockAttempts.$inferSelect): ActiveMock {
  const index = questionIndex();
  const found = row.questionIds.map((id) => index.get(id)).filter((x) => x !== undefined);
  return {
    id: row.id,
    questions: found.map((f) => toMockQuestion(f.question, f.day)),
    passages: uniquePassages(found.map((f) => f.passage)),
    startedAt: row.startedAt,
    deadlineAt: row.deadlineAt,
  };
}

/** How many questions a mock would have now, and whether one can start. */
export async function mockAvailability(student: StudentLike, settings: Settings, now = new Date()) {
  const size = (await pool(student, settings, now)).length;
  const questions = Math.min(size, MOCK_MAX_QUESTIONS);
  return {
    available: size >= MOCK_MIN_POOL,
    questions,
    minutes: Math.ceil(mockSeconds(questions) / 60),
  };
}

/** The unsubmitted mock still inside its time (with grace), if any. */
export async function activeMock(studentId: string, now = new Date()): Promise<ActiveMock | null> {
  const db = await getDb();
  const row = await db.query.mockAttempts.findFirst({
    where: and(
      eq(schema.mockAttempts.studentId, studentId),
      isNull(schema.mockAttempts.submittedAt),
    ),
    orderBy: desc(schema.mockAttempts.startedAt),
  });
  if (!row || row.deadlineAt.getTime() + MOCK_GRACE_MS < now.getTime()) return null;
  return activeFromRow(row);
}

export async function mockHistory(studentId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.mockAttempts.id,
      score: schema.mockAttempts.score,
      questionIds: schema.mockAttempts.questionIds,
      submittedAt: schema.mockAttempts.submittedAt,
    })
    .from(schema.mockAttempts)
    .where(eq(schema.mockAttempts.studentId, studentId))
    .orderBy(desc(schema.mockAttempts.startedAt))
    .limit(10);
  return rows
    .filter((r) => r.submittedAt && r.score !== null)
    .map((r) => ({
      id: r.id,
      score: r.score!,
      total: r.questionIds.length,
      submittedAt: r.submittedAt!,
    }));
}

/** Starts a mock, or returns the one already running. */
export async function startMock(
  student: StudentLike,
  settings: Settings,
  now = new Date(),
  rand: () => number = seededRandom(randomInt(2 ** 31)),
): Promise<{ ok: true; mock: ActiveMock } | { ok: false; reason: 'NOT_ENOUGH' }> {
  const running = await activeMock(student.id, now);
  if (running) return { ok: true, mock: running };
  const items = await pool(student, settings, now);
  if (items.length < MOCK_MIN_POOL) return { ok: false, reason: 'NOT_ENOUGH' };
  const picked = pickMockQuestions(items, MOCK_MAX_QUESTIONS, rand);
  const db = await getDb();
  const [row] = await db
    .insert(schema.mockAttempts)
    .values({
      studentId: student.id,
      questionIds: picked.map((p) => p.question.id),
      startedAt: now,
      deadlineAt: new Date(now.getTime() + mockSeconds(picked.length) * 1000),
    })
    .returning();
  await recordEvent('mock_started', { questions: picked.length }, { studentId: student.id });
  return { ok: true, mock: activeFromRow(row!) };
}

/** Marks a mock from the server's own copy of the questions. One submission only. */
export async function submitMock(
  studentId: string,
  attemptId: string,
  answers: Record<string, OptionKey>,
  now = new Date(),
): Promise<
  { ok: true; result: MockResult } | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_SUBMITTED' }
> {
  const db = await getDb();
  const row = await db.query.mockAttempts.findFirst({
    where: and(eq(schema.mockAttempts.id, attemptId), eq(schema.mockAttempts.studentId, studentId)),
  });
  if (!row) return { ok: false, reason: 'NOT_FOUND' };
  if (row.submittedAt) return { ok: false, reason: 'ALREADY_SUBMITTED' };

  const index = questionIndex();
  const found = row.questionIds.map((id) => index.get(id)).filter((x) => x !== undefined);
  const kept = Object.fromEntries(
    Object.entries(answers).filter(([id]) => row.questionIds.includes(id)),
  );
  const marked = scoreMock(
    found.map((f) => f.question),
    kept,
  );
  const late = now.getTime() > row.deadlineAt.getTime() + MOCK_GRACE_MS;
  const updated = await db
    .update(schema.mockAttempts)
    .set({
      submittedAt: now,
      answers: kept,
      score: marked.score,
      topicScores: marked.topicScores,
      late,
    })
    .where(and(eq(schema.mockAttempts.id, row.id), isNull(schema.mockAttempts.submittedAt)))
    .returning({ id: schema.mockAttempts.id });
  if (!updated.length) return { ok: false, reason: 'ALREADY_SUBMITTED' };
  await recordEvent(
    'mock_submitted',
    { score: marked.score, total: marked.total, late },
    { studentId },
  );

  const content = getContent();
  const weakestDay = marked.weakestTopic
    ? ([...content.lessons].find(([, l]) => l.data?.topicTag === marked.weakestTopic)?.[0] ?? null)
    : null;
  return {
    ok: true,
    result: {
      id: row.id,
      ...marked,
      late,
      weakestDay,
      topicNames: content.topics,
      review: found.map((f) => {
        const p = toPublicQuestion(f.question);
        return {
          ...toMockQuestion(f.question, f.day),
          answer: p.answer,
          explanation: p.explanation,
          chosen: kept[p.id] ?? null,
        };
      }),
      passages: uniquePassages(found.map((f) => f.passage)),
    },
  };
}
