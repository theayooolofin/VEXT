// Writes test-only content to content/jamb-english/_fixtures. Every item is
// marked "fixture": true and is never served in production. The three items
// from BUILD_SPEC Appendix A are used as written; everything else is plainly
// synthetic so nobody mistakes it for real lesson content.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('content/jamb-english/_fixtures');
const write = (rel: string, data: unknown) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

const topics = {
  concord: 'concord',
  tenses: 'tenses',
  prepositions_articles: 'prepositions and articles',
  vocabulary: 'vocabulary',
  oral_forms: 'oral forms',
  error_spotting: 'error spotting',
};
const topicTags = Object.keys(topics);
const LETTERS = ['A', 'B', 'C', 'D'] as const;

const appendixA = [
  {
    id: 'dg-q01',
    stem: 'Neither the teacher nor the students ___ present.',
    options: { A: 'was', B: 'were', C: 'is', D: 'has been' },
    answer: 'B',
    explanation: "With neither...nor, the verb agrees with the nearer subject, and 'students' is plural.",
    topicTag: 'concord',
    heroEligible: true,
    fixture: true,
  },
  {
    id: 'dg-q02',
    stem: 'Each of the boys ___ a textbook.',
    options: { A: 'have', B: 'has', C: 'are', D: 'were' },
    answer: 'B',
    explanation: "'Each' is singular, so it takes 'has'.",
    topicTag: 'concord',
    fixture: true,
  },
  {
    id: 'dg-q03',
    stem: 'She is afraid ___ snakes.',
    options: { A: 'at', B: 'of', C: 'from', D: 'with' },
    answer: 'B',
    explanation: "'Afraid' is followed by 'of'.",
    topicTag: 'prepositions_articles',
    fixture: true,
  },
];

const synthetic = (id: string, label: string, answer: (typeof LETTERS)[number], topicTag: string) => ({
  id,
  stem: `Test item ${label}. Pick the option marked as correct for testing (${answer}).`,
  options: { A: 'first choice', B: 'second choice', C: 'third choice', D: 'fourth choice' },
  answer,
  explanation: `Fixture only: option ${answer} is the answer used by the tests.`,
  topicTag,
  fixture: true,
});

const diagnostic = {
  version: 1,
  fixture: true,
  topicPriority: ['concord', 'tenses', 'prepositions_articles', 'vocabulary', 'oral_forms', 'error_spotting'],
  questions: [
    ...appendixA,
    ...Array.from({ length: 7 }, (_, i) => {
      const n = i + 4;
      return synthetic(`dg-q${String(n).padStart(2, '0')}`, `dg-${n}`, LETTERS[n % 4]!, topicTags[(i + 1) % topicTags.length]!);
    }),
  ],
};

const DIFFICULTY = ['easy', 'easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'medium', 'hard', 'hard'];

function lesson(day: number) {
  const dd = String(day).padStart(2, '0');
  const topicTag = topicTags[(day - 1) % topicTags.length]!;
  const questions = Array.from({ length: 10 }, (_, i) => {
    const q = synthetic(`d${dd}-q${String(i + 1).padStart(2, '0')}`, `Day ${day}, question ${i + 1}`, LETTERS[(i + day) % 4]!, topicTag);
    return { ...q, difficulty: DIFFICULTY[i]!, passageId: null as string | null };
  });
  if (day === 1) {
    questions[0] = {
      ...questions[0]!,
      stem: 'Neither the teacher nor the students ___ present.',
      options: { A: 'was', B: 'were', C: 'is', D: 'has been' },
      answer: 'B',
      explanation: "With neither...nor, the verb agrees with the nearer subject, and 'students' is plural.",
    };
    // Exercises the three inline marks.
    questions[1] = { ...questions[1]!, stem: 'Test item with **bold**, *italic* and [[underlined words]]. Pick the marked option.' };
  }
  const passages = day === 2 ? [{ id: 'p1', title: 'Fixture passage', body: 'This short passage exists only to test the passage card.\n\nIt has two paragraphs.' }] : [];
  if (day === 2) questions[0] = { ...questions[0]!, passageId: 'p1' };
  if (day === 5) {
    // IPA characters, to check the font stack renders them.
    questions[0] = { ...questions[0]!, stem: 'Test item: which symbol is the vowel in "thin"?', options: { A: '/ɪ/', B: '/iː/', C: '/θ/', D: '/ʃ/' }, answer: 'A' };
    questions[1] = { ...questions[1]!, stem: 'Test item: IPA check ʒ ŋ ð æ ɔː ʊə eɪ.', options: { A: '/ʒ/', B: '/ŋ/', C: '/ð/', D: '/æ/' } };
  }
  return {
    day,
    slug: `fixture-day-${dd}`,
    title: day === 1 ? 'Concord: subject and verb agreement' : `Fixture lesson for Day ${day}`,
    topicTag,
    version: 1,
    fixture: true,
    rule: {
      body: day === 1 ? 'A singular subject takes a singular verb. A plural subject takes a plural verb.' : `Fixture rule text for Day ${day}.`,
      example: day === 1 ? 'Each of the boys has a book.' : 'Fixture example sentence.',
    },
    passages,
    questions,
  };
}

fs.rmSync(root, { recursive: true, force: true });
write('topics.json', topics);
write('diagnostic.json', diagnostic);
write('review.json', []);
for (let d = 1; d <= 14; d++) write(`lessons/day-${String(d).padStart(2, '0')}.json`, lesson(d));

// Broken fixtures for the validator tests (spec Appendix A).
const good = lesson(3);
const broken: Record<string, unknown> = {
  'three-options': { ...good, questions: good.questions.map((q, i) => (i === 0 ? { ...q, options: { A: 'a', B: 'b', C: 'c' } } : q)) },
  'answer-not-in-options': { ...good, questions: good.questions.map((q, i) => (i === 0 ? { ...q, answer: 'E' } : q)) },
  'missing-explanation': { ...good, questions: good.questions.map((q, i) => (i === 0 ? { ...q, explanation: '' } : q)) },
  'duplicate-id': { ...good, questions: good.questions.map((q, i) => (i === 1 ? { ...q, id: good.questions[0]!.id } : q)) },
  'unknown-topic': { ...good, questions: good.questions.map((q, i) => (i === 0 ? { ...q, topicTag: 'astrology' } : q)) },
  'nine-questions': { ...good, questions: good.questions.slice(0, 9) },
  'duplicate-stem': { ...good, questions: good.questions.map((q, i) => (i === 1 ? { ...q, stem: good.questions[0]!.stem } : q)) },
  'duplicate-options': { ...good, questions: good.questions.map((q, i) => (i === 0 ? { ...q, options: { A: 'same', B: 'same', C: 'c', D: 'd' } } : q)) },
  'long-explanation': { ...good, questions: good.questions.map((q, i) => (i === 0 ? { ...q, explanation: 'x'.repeat(301) } : q)) },
  'bad-difficulty': { ...good, questions: good.questions.map((q, i) => (i === 0 ? { ...q, difficulty: 'tricky' } : q)) },
  'missing-passage': { ...good, questions: good.questions.map((q, i) => (i === 0 ? { ...q, passageId: 'nope' } : q)) },
  'long-rule': { ...good, rule: { body: 'x'.repeat(701), example: '' } },
  'bad-id': { ...good, questions: good.questions.map((q, i) => (i === 0 ? { ...q, id: 'q1' } : q)) },
  'missing-stem': { ...good, questions: good.questions.map((q, i) => (i === 0 ? { ...q, stem: '' } : q)) },
};
for (const [name, data] of Object.entries(broken)) write(`broken/${name}.json`, data);

console.log(`Fixtures written to ${path.relative(process.cwd(), root)}`);
