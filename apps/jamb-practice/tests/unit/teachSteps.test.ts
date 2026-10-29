import { describe, expect, it } from 'vitest';
import { questionStep, stepForKey, teachSteps } from '@/lib/teachSteps';

describe('teachSteps', () => {
  const steps = teachSteps(10);

  it('runs title, rule, ask and reveal for each question, then the answer key', () => {
    expect(steps).toHaveLength(23);
    expect(steps[0]).toEqual({ kind: 'title' });
    expect(steps[1]).toEqual({ kind: 'rule' });
    expect(steps[2]).toEqual({ kind: 'question', index: 0, revealed: false });
    expect(steps[3]).toEqual({ kind: 'question', index: 0, revealed: true });
    expect(steps[questionStep(9)]).toEqual({ kind: 'question', index: 9, revealed: false });
    expect(steps[22]).toEqual({ kind: 'key' });
  });

  it('moves forward with Space, arrows and a clicker, and stops at the ends', () => {
    expect(stepForKey(' ', 2, steps)).toBe(3);
    expect(stepForKey('PageDown', 3, steps)).toBe(4);
    expect(stepForKey('ArrowLeft', 4, steps)).toBe(3);
    expect(stepForKey('PageUp', 0, steps)).toBe(0);
    expect(stepForKey('ArrowRight', 22, steps)).toBe(22);
    expect(stepForKey('End', 5, steps)).toBe(22);
    expect(stepForKey('Home', 5, steps)).toBe(0);
  });

  it('jumps to a question with its number key, 0 being question 10', () => {
    expect(stepForKey('1', 20, steps)).toBe(2);
    expect(stepForKey('0', 2, steps)).toBe(questionStep(9));
    expect(stepForKey('4', 0, teachSteps(3))).toBeNull();
    expect(stepForKey('x', 0, steps)).toBeNull();
  });
});
