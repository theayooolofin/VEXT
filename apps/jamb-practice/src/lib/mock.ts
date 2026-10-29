// The timed mock: pure rules for choosing, ordering, timing and marking.
// The server owns all of it; the browser only receives the questions without answers.
import type { OptionKey, Question } from './contentSchema';

export const MOCK_MAX_QUESTIONS = 40;
/** Fewer unlocked questions than this and a mock would only repeat Day 1. */
export const MOCK_MIN_POOL = 20;
/** The UTME allows about 40 seconds a question; a little more while practising. */
export const MOCK_SECONDS_PER_QUESTION = 45;
/** A submission this long after the deadline still counts as on time (slow networks). */
export const MOCK_GRACE_MS = 30_000;

/** Like the paper: passages first, then lexis, then structure, then oral forms last. */
const SECTION_ORDER = [
  'comprehension',
  'vocabulary',
  'idioms',
  'concord',
  'tenses',
  'prepositions_articles',
  'pronouns_tags',
  'error_spotting',
  'oral_forms',
];

export type PoolQuestion = Question & { day: number };
export type Passage = { id: string; title?: string; body: string };
export type PoolItem = { question: PoolQuestion; passage?: Passage };

/** Question ids look like d07-q03; the day is in the id. */
export function dayOfQuestion(id: string): number | null {
  const m = /^d(\d{2})-q\d{2}$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** A small seeded generator, so a test can repeat a draw exactly. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type Unit = { items: PoolItem[]; topic: string; isPassage: boolean };

/**
 * Chooses up to `size` questions, spread across topics. The questions on one
 * passage stay together, and the result is ordered like the paper.
 */
export function pickMockQuestions(pool: PoolItem[], size: number, rand: () => number): PoolItem[] {
  const units: Unit[] = [];
  const byPassage = new Map<string, Unit>();
  for (const item of pool) {
    const p = item.question.passageId;
    if (p && item.passage) {
      const key = `${item.question.day}:${p}`;
      let u = byPassage.get(key);
      if (!u) {
        u = { items: [], topic: item.question.topicTag, isPassage: true };
        byPassage.set(key, u);
        units.push(u);
      }
      u.items.push(item);
    } else {
      units.push({ items: [item], topic: item.question.topicTag, isPassage: false });
    }
  }

  const byTopic = new Map<string, Unit[]>();
  for (const u of units) byTopic.set(u.topic, [...(byTopic.get(u.topic) ?? []), u]);
  const queues = shuffle(
    [...byTopic.values()].map((list) => shuffle(list, rand)),
    rand,
  );

  const picked: Unit[] = [];
  let count = 0;
  let added = true;
  while (added && count < size) {
    added = false;
    for (const q of queues) {
      const i = q.findIndex((u) => count + u.items.length <= size);
      if (i < 0) continue;
      const [u] = q.splice(i, 1);
      picked.push(u!);
      count += u!.items.length;
      added = true;
      if (count >= size) break;
    }
  }

  const rank = (u: Unit) => {
    if (u.isPassage) return -1;
    const r = SECTION_ORDER.indexOf(u.topic);
    return r < 0 ? SECTION_ORDER.length : r;
  };
  return picked
    .map((u, i) => ({ u, i }))
    .sort((a, b) => rank(a.u) - rank(b.u) || a.i - b.i)
    .flatMap(({ u }) => u.items);
}

export function mockSeconds(questionCount: number): number {
  return questionCount * MOCK_SECONDS_PER_QUESTION;
}

export type MockScore = {
  score: number;
  total: number;
  answered: number;
  topicScores: Record<string, { correct: number; asked: number }>;
  weakestTopic: string | null;
};

/** Marks a mock. Unanswered questions count as wrong, as in the exam. */
export function scoreMock(questions: Question[], answers: Record<string, OptionKey>): MockScore {
  const topicScores: MockScore['topicScores'] = {};
  let score = 0;
  let answered = 0;
  for (const q of questions) {
    const t = (topicScores[q.topicTag] ??= { correct: 0, asked: 0 });
    t.asked++;
    const a = answers[q.id];
    if (a) answered++;
    if (a === q.answer) {
      score++;
      t.correct++;
    }
  }
  let weakestTopic: string | null = null;
  let worst = Infinity;
  for (const [topic, t] of Object.entries(topicScores)) {
    const rate = t.correct / t.asked;
    if (t.correct < t.asked && rate < worst) {
      worst = rate;
      weakestTopic = topic;
    }
  }
  return { score, total: questions.length, answered, topicScores, weakestTopic };
}
