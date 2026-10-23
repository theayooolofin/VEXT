import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentHash, validateLesson } from '@/lib/contentRules';
import { lessonSchema } from '@/lib/contentSchema';
import { isServable, loadContentSet } from '@/lib/contentStore';

const FIX = path.resolve('content/jamb-english/_fixtures');
const topics = JSON.parse(fs.readFileSync(path.join(FIX, 'topics.json'), 'utf8'));

function check(name: string) {
  const raw = JSON.parse(fs.readFileSync(path.join(FIX, 'broken', `${name}.json`), 'utf8'));
  return validateLesson(lessonSchema.parse(raw), topics, new Map()).errors.join('\n');
}

describe('content validation: one test per rule (spec 8.4)', () => {
  it('the fixture set is valid', () => {
    const set = loadContentSet(FIX);
    expect(set.errors).toEqual([]);
    expect(set.diagnostic.status).toBe('draft');
    for (const [, item] of set.lessons) expect(item.errors).toEqual([]);
  });
  it.each([
    ['nine-questions', /has 9 questions/],
    ['three-options', /exactly four options/],
    ['answer-not-in-options', /answer "E" is not one of the options/],
    ['missing-explanation', /explanation is missing/],
    ['long-explanation', /explanation is 301 characters/],
    ['duplicate-id', /already used/],
    ['unknown-topic', /unknown topicTag "astrology"/],
    ['duplicate-stem', /same stem/],
    ['duplicate-options', /same text/],
    ['bad-difficulty', /difficulty must be/],
    ['missing-passage', /passage "nope" does not exist/],
    ['long-rule', /rule body is 701 characters/],
    ['bad-id', /id must match/],
    ['missing-stem', /stem is missing/],
  ])('%s fails with a clear message', (name, pattern) => {
    expect(check(name)).toMatch(pattern);
  });

  it('warns, but does not fail, on the difficulty mix', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(FIX, 'lessons', 'day-03.json'), 'utf8'));
    raw.questions = raw.questions.map((q: object) => ({ ...q, difficulty: 'easy' }));
    const r = validateLesson(lessonSchema.parse(raw), topics, new Map());
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/difficulty mix/);
  });

  it('reports ids duplicated across lessons', () => {
    const seen = new Map<string, string>();
    const raw = JSON.parse(fs.readFileSync(path.join(FIX, 'lessons', 'day-03.json'), 'utf8'));
    validateLesson(lessonSchema.parse(raw), topics, seen);
    expect(validateLesson(lessonSchema.parse(raw), topics, seen).errors.join()).toMatch(/already used/);
  });
});

describe('teacher approval (spec 8.5)', () => {
  function tempContent() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-content-'));
    fs.cpSync(FIX, dir, { recursive: true });
    // Pretend it is real content so approval can apply.
    const file = path.join(dir, 'lessons', 'day-04.json');
    const lesson = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete lesson.fixture;
    lesson.questions = lesson.questions.map((q: Record<string, unknown>) => {
      const { fixture: _f, ...rest } = q;
      return rest;
    });
    fs.writeFileSync(file, JSON.stringify(lesson, null, 2));
    return { dir, file, lesson };
  }

  it('the hash ignores formatting but not content', () => {
    const a = { b: 1, a: [1, 2] };
    expect(contentHash(a)).toBe(contentHash(JSON.parse(JSON.stringify({ a: [1, 2], b: 1 }))));
    expect(contentHash(a)).not.toBe(contentHash({ b: 2, a: [1, 2] }));
  });

  it('approved content is served; an edit after approval withdraws it', () => {
    const { dir, file, lesson } = tempContent();
    const hash = loadContentSet(dir).lessons.get(4)!.hash!;
    fs.writeFileSync(
      path.join(dir, 'review.json'),
      JSON.stringify([{ day: 4, status: 'teacher_approved', reviewer: 'T', reviewedAt: '2026-10-23', contentHash: hash }]),
    );
    let item = loadContentSet(dir).lessons.get(4)!;
    expect(item.status).toBe('approved');
    expect(isServable(item, false)).toBe(true);

    lesson.questions[0].explanation = 'Edited after approval.';
    fs.writeFileSync(file, JSON.stringify(lesson, null, 2));
    item = loadContentSet(dir).lessons.get(4)!;
    expect(item.status).toBe('edited_after_approval');
    expect(isServable(item, false)).toBe(false);
    expect(isServable(item, true)).toBe(true);
  });

  it('unreviewed content and fixtures are unavailable when unreviewed content is off', () => {
    const set = loadContentSet(FIX);
    expect(isServable(set.lessons.get(1)!, false)).toBe(false);
    expect(isServable(set.diagnostic, false)).toBe(false);
    expect(isServable(set.lessons.get(1)!, true)).toBe(true);
  });
});
