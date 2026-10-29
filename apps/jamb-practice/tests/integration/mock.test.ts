import { beforeAll, describe, expect, it } from 'vitest';
import { servableLesson } from '@/lib/content';
import { MOCK_GRACE_MS, dayOfQuestion } from '@/lib/mock';
import { startMock, submitMock } from '@/lib/mockRepo';
import { getSettings } from '@/lib/settingsRepo';
import { ageStudent, client, freshDb, req, signUp, studentIdOf, type Client } from './helpers';
import { GET as mockRoute } from '../../app/api/mock/route';
import { POST as startRoute } from '../../app/api/mock/start/route';
import { POST as submitRoute } from '../../app/api/mock/submit/route';

const getMock = (c: Client) => mockRoute(req(c, 'GET', '/api/mock'));
const start = (c: Client) => startRoute(req(c, 'POST', '/api/mock/start', {}));
const submit = (c: Client, body: unknown) => submitRoute(req(c, 'POST', '/api/mock/submit', body));

/** The right answer to every question, from the server's own copy. */
function answerKey(): Record<string, string> {
  const key: Record<string, string> = {};
  for (let day = 1; day <= 14; day++)
    for (const q of servableLesson(day)?.questions ?? []) key[q.id] = q.answer;
  return key;
}

beforeAll(async () => {
  await freshDb();
});

describe('timed mock', () => {
  it('is not offered while only Day 1 is open', async () => {
    const c = client();
    await signUp(c);
    const page = await (await getMock(c)).json();
    expect(page).toMatchObject({ available: false, questions: 10, active: null });
    const res = await start(c);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('MOCK_NOT_READY');
  });

  it('uses only open days, never sends answers, and marks on the server once', async () => {
    const c = client();
    await signUp(c);
    await ageStudent(await studentIdOf(c), 3); // Days 1 to 3 open; Day 4 needs payment

    const page = await (await getMock(c)).json();
    expect(page).toMatchObject({ available: true, questions: 30, minutes: 23 });

    const res = await start(c);
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toMatch(/"answer"|"explanation"/);
    const { mock } = JSON.parse(raw);
    expect(mock.questions).toHaveLength(30);
    expect(mock.questions.every((q: { id: string }) => (dayOfQuestion(q.id) ?? 99) <= 3)).toBe(
      true,
    );
    expect(new Date(mock.deadlineAt).getTime() - new Date(mock.startedAt).getTime()).toBe(
      30 * 45_000,
    );

    // Starting again resumes the same mock.
    expect((await (await start(c)).json()).mock.id).toBe(mock.id);
    expect((await (await getMock(c)).json()).active.id).toBe(mock.id);

    // Right on the first 20, wrong on 5, blank on 5; an id from outside the mock is ignored.
    const key = answerKey();
    const answers: Record<string, string> = { 'd09-q01': 'A' };
    mock.questions.forEach((q: { id: string }, i: number) => {
      if (i < 20) answers[q.id] = key[q.id]!;
      else if (i < 25) answers[q.id] = key[q.id] === 'A' ? 'B' : 'A';
    });

    const other = client();
    await signUp(other);
    expect((await submit(other, { attemptId: mock.id, answers })).status).toBe(404);

    const marked = await submit(c, { attemptId: mock.id, answers });
    expect(marked.status).toBe(200);
    const result = await marked.json();
    expect(result).toMatchObject({ score: 20, total: 30, answered: 25, late: false });
    expect(result.review).toHaveLength(30);
    expect(result.review[0]).toHaveProperty('answer');
    expect(result.review[0]).toHaveProperty('explanation');
    expect(
      Object.values(result.topicScores as Record<string, { asked: number }>).reduce(
        (n, t) => n + t.asked,
        0,
      ),
    ).toBe(30);

    expect((await submit(c, { attemptId: mock.id, answers })).status).toBe(409);
    const after = await (await getMock(c)).json();
    expect(after.active).toBeNull();
    expect(after.history[0]).toMatchObject({ id: mock.id, score: 20, total: 30 });
  });

  it('marks a submission after the deadline as late, and still scores it', async () => {
    const c = client();
    await signUp(c);
    const studentId = await studentIdOf(c);
    await ageStudent(studentId, 3);
    const student = { id: studentId, createdAt: new Date(Date.now() - 3 * 86_400_000) };
    const r = await startMock(student, await getSettings());
    if (!r.ok) throw new Error('mock did not start');
    const late = new Date(r.mock.deadlineAt.getTime() + MOCK_GRACE_MS + 1000);
    const marked = await submitMock(studentId, r.mock.id, {}, late);
    expect(marked.ok && marked.result).toMatchObject({ late: true, score: 0, answered: 0 });
  });
});
