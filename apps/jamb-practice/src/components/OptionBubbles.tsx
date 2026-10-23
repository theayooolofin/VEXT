'use client';

import { renderMarks } from './Rich';

export const LETTERS = ['A', 'B', 'C', 'D'] as const;
export type Letter = (typeof LETTERS)[number];

function Tick() {
  return (
    <svg className="mark" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M5 15 L11.5 21 L23 7" />
    </svg>
  );
}
function Cross() {
  return (
    <svg className="mark" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M7 7 L21 21 M21 7 L7 21" />
    </svg>
  );
}

/**
 * Exam answer-sheet bubbles. Real radio inputs, so keyboard and screen
 * readers work. Once `correct` is known the group locks and is marked.
 */
export function OptionBubbles({
  name,
  options,
  selected,
  correct,
  onSelect,
  legend,
  markResult = true,
}: {
  name: string;
  options: Record<Letter, string>;
  selected: Letter | null;
  correct: Letter | null;
  onSelect: (l: Letter) => void;
  legend: string;
  markResult?: boolean;
}) {
  const locked = correct !== null;
  return (
    <fieldset className={`options${locked ? ' locked' : ''}`}>
      <legend className="sr-only">{legend}</legend>
      {LETTERS.map((l) => {
        const isSel = selected === l;
        const showCorrect = markResult && correct === l;
        const showWrong = markResult && correct !== null && isSel && correct !== l;
        const cls = ['option', showCorrect && 'is-correct', showWrong && 'is-wrong', showCorrect && selected !== l && 'was-missed']
          .filter(Boolean)
          .join(' ');
        return (
          <label key={l} className={cls}>
            <input
              type="radio"
              name={name}
              value={l}
              checked={isSel}
              disabled={locked && !isSel}
              onChange={() => !locked && onSelect(l)}
            />
            <span className="bubble" aria-hidden="true">
              <span>{l}</span>
            </span>
            <span className="option-text">
              <span className="sr-only">Option {l}: </span>
              {renderMarks(options[l])}
              {showCorrect && <span className="sr-only"> (correct answer)</span>}
              {showWrong && <span className="sr-only"> (your answer, wrong)</span>}
            </span>
            {showCorrect && <Tick />}
            {showWrong && <Cross />}
          </label>
        );
      })}
    </fieldset>
  );
}
