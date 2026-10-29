// The order a teacher moves through a day in Teach mode. Each question has two
// steps: asked (options only) and revealed (answer marked, explanation shown).

export type TeachStep =
  | { kind: 'title' }
  | { kind: 'rule' }
  | { kind: 'question'; index: number; revealed: boolean }
  | { kind: 'key' };

export function teachSteps(questionCount: number): TeachStep[] {
  const steps: TeachStep[] = [{ kind: 'title' }, { kind: 'rule' }];
  for (let index = 0; index < questionCount; index++) {
    steps.push(
      { kind: 'question', index, revealed: false },
      { kind: 'question', index, revealed: true },
    );
  }
  steps.push({ kind: 'key' });
  return steps;
}

/** The step where question `index` (0-based) is first asked. */
export function questionStep(index: number): number {
  return 2 + index * 2;
}

/** Maps a key press to the step to show next, or null when the key does nothing. */
export function stepForKey(key: string, current: number, steps: TeachStep[]): number | null {
  const last = steps.length - 1;
  const questions = (steps.length - 3) / 2;
  if (key === 'ArrowRight' || key === ' ' || key === 'PageDown' || key === 'Enter')
    return Math.min(current + 1, last);
  if (key === 'ArrowLeft' || key === 'PageUp' || key === 'Backspace')
    return Math.max(current - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  if (/^[0-9]$/.test(key)) {
    const index = key === '0' ? 9 : Number(key) - 1;
    return index < questions ? questionStep(index) : null;
  }
  return null;
}
