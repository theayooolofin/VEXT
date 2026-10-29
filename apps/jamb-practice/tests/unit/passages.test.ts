import { describe, expect, it } from 'vitest';
import { isFirstPassageQuestion } from '@/lib/passages';

describe('isFirstPassageQuestion', () => {
  const questions = [
    { passageId: null },
    {},
    { passageId: 'p1' },
    { passageId: 'p1' },
    { passageId: 'p2' },
    { passageId: 'p1' },
  ];

  it('is true only for the first question that uses each passage', () => {
    expect(questions.map((_, i) => isFirstPassageQuestion(questions, i))).toEqual([
      false,
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  it('is false for an index outside the lesson', () => {
    expect(isFirstPassageQuestion(questions, 99)).toBe(false);
  });
});
