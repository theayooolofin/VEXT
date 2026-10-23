'use client';

import { useEffect, useState } from 'react';
import { track } from '@/client/api';
import type { PublicQuestion } from '@/lib/contentSchema';
import { OptionBubbles, type Letter } from './OptionBubbles';
import { renderMarks } from './Rich';

/** One real question, marked instantly in the browser with no network call. */
export function HeroQuestion({ q }: { q: PublicQuestion }) {
  const [selected, setSelected] = useState<Letter | null>(null);
  useEffect(() => track('hero_question_shown'), []);
  const answered = selected !== null;
  const correct = selected === q.answer;

  return (
    <div className="question-card" aria-labelledby="hero-q">
      <p className="card-label">Try one question</p>
      <p id="hero-q" className="stem">
        {renderMarks(q.stem)}
      </p>
      <OptionBubbles
        name="hero"
        legend="Choose an answer"
        options={q.options}
        selected={selected}
        correct={answered ? q.answer : null}
        onSelect={(l) => {
          setSelected(l);
          track('hero_question_answered', { correct: l === q.answer });
        }}
      />
      <div aria-live="polite">
        {answered && (
          <div className={`feedback fade-in ${correct ? 'correct' : 'wrong'}`}>
            <strong>{correct ? 'Correct.' : `Not quite. The answer is ${q.answer}.`}</strong>
            {renderMarks(q.explanation)}
          </div>
        )}
      </div>
    </div>
  );
}
