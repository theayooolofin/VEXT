import { describe, expect, it } from 'vitest';
import {
  dayOfQuestion,
  mockSeconds,
  pickMockQuestions,
  scoreMock,
  seededRandom,
  type PoolItem,
} from '@/lib/mock';

function q(day: number, n: number, topicTag: string, passageId: string | null = null): PoolItem {
  const id = `d${String(day).padStart(2, '0')}-q${String(n).padStart(2, '0')}`;
  return {
    question: {
      id,
      day,
      stem: `Stem ${id}`,
      options: { A: 'a', B: 'b', C: 'c', D: 'd' },
      answer: 'A',
      explanation: 'Because.',
      difficulty: 'easy',
      topicTag,
      passageId,
    },
    passage: passageId ? { id: passageId, body: 'A passage.' } : undefined,
  };
}

/** Three days of 10: day 1 concord with a passage on 7, 8 and 10, day 2 tenses, day 3 oral forms. */
function pool(): PoolItem[] {
  const items: PoolItem[] = [];
  for (let n = 1; n <= 10; n++)
    items.push(q(1, n, 'concord', [7, 8, 10].includes(n) ? 'p1' : null));
  for (let n = 1; n <= 10; n++) items.push(q(2, n, 'tenses'));
  for (let n = 1; n <= 10; n++) items.push(q(3, n, 'oral_forms'));
  return items;
}

describe('pickMockQuestions', () => {
  it('takes every question when the pool is smaller than the mock', () => {
    const picked = pickMockQuestions(pool(), 40, seededRandom(1));
    expect(picked).toHaveLength(30);
    expect(new Set(picked.map((p) => p.question.id)).size).toBe(30);
  });

  it('stays within the size, keeps a passage together and spreads topics', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const picked = pickMockQuestions(pool(), 12, seededRandom(seed));
      expect(picked.length).toBeLessThanOrEqual(12);
      expect(picked.length).toBeGreaterThanOrEqual(10);
      const passage = picked.filter((p) => p.question.passageId === 'p1').length;
      expect([0, 3]).toContain(passage);
      const topics = new Set(picked.map((p) => p.question.topicTag));
      expect(topics.size).toBe(3);
    }
  });

  it('orders like the paper: passages first, oral forms last', () => {
    const picked = pickMockQuestions(pool(), 40, seededRandom(7));
    const tags = picked.map((p) => (p.question.passageId ? 'passage' : p.question.topicTag));
    expect(tags.slice(0, 3)).toEqual(['passage', 'passage', 'passage']);
    expect(tags.slice(-10).every((t) => t === 'oral_forms')).toBe(true);
    expect(tags.indexOf('tenses')).toBeGreaterThan(tags.lastIndexOf('concord'));
  });

  it('repeats a draw exactly with the same seed', () => {
    const a = pickMockQuestions(pool(), 15, seededRandom(42)).map((p) => p.question.id);
    const b = pickMockQuestions(pool(), 15, seededRandom(42)).map((p) => p.question.id);
    expect(a).toEqual(b);
  });
});

describe('scoreMock', () => {
  const questions = pool()
    .slice(0, 4)
    .concat(pool().slice(10, 12))
    .map((p) => p.question);

  it('marks answers, counts blanks as wrong and finds the weakest topic', () => {
    const r = scoreMock(questions, {
      'd01-q01': 'A',
      'd01-q02': 'B',
      'd02-q01': 'A',
      'd02-q02': 'A',
    });
    expect(r).toMatchObject({ score: 3, total: 6, answered: 4, weakestTopic: 'concord' });
    expect(r.topicScores).toEqual({
      concord: { correct: 1, asked: 4 },
      tenses: { correct: 2, asked: 2 },
    });
  });

  it('has no weakest topic when everything is right', () => {
    const all = Object.fromEntries(questions.map((x) => [x.id, 'A' as const]));
    expect(scoreMock(questions, all).weakestTopic).toBeNull();
  });
});

describe('helpers', () => {
  it('reads the day from a question id and times the mock', () => {
    expect(dayOfQuestion('d07-q03')).toBe(7);
    expect(dayOfQuestion('dg-q01')).toBeNull();
    expect(mockSeconds(40)).toBe(1800);
  });
});
