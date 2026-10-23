'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, track } from '@/client/api';
import type { PublicQuestion } from '@/lib/contentSchema';
import { OptionBubbles, type Letter } from './OptionBubbles';
import { renderMarks } from './Rich';

type Q = Omit<PublicQuestion, 'answer' | 'explanation'>;

/** Ten questions, one per screen, no feedback until the end. */
export function Diagnostic({ questions }: { questions: Q[] }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Letter>>({});
  const [selected, setSelected] = useState<Letter | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(new Date().toISOString());
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => track('diagnostic_started'), []);
  useEffect(() => {
    if (i > 0) heading.current?.focus();
  }, [i]);

  const q = questions[i]!;
  const last = i === questions.length - 1;

  async function next() {
    if (!selected) return;
    const all = { ...answers, [q.id]: selected };
    setAnswers(all);
    if (!last) {
      setSelected(null);
      setI(i + 1);
      return;
    }
    setBusy(true);
    setError(null);
    const r = await api('/api/diagnostic/submit', { body: { answers: all, startedAt: startedAt.current } });
    if (r.ok) {
      router.push('/check/result');
      return;
    }
    setBusy(false);
    setError(r.message);
    track('error_shown', { code: r.code });
  }

  return (
    <div>
      <div className="progress-head" aria-hidden="true">
        <span>Free check</span>
        <span>
          {i + 1} of {questions.length}
        </span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={1}
        aria-valuemax={questions.length}
        aria-valuenow={i + 1}
        aria-valuetext={`Question ${i + 1} of ${questions.length}`}
      >
        <span style={{ width: `${((i + 1) / questions.length) * 100}%` }} />
      </div>
      <div className="question-card fade-in" key={q.id}>
        <h2 ref={heading} tabIndex={-1} className="sr-only">
          Question {i + 1} of {questions.length}
        </h2>
        <p className="stem">{renderMarks(q.stem)}</p>
        <OptionBubbles
          name={`dg-${q.id}`}
          legend="Choose an answer"
          options={q.options}
          selected={selected}
          correct={null}
          markResult={false}
          onSelect={setSelected}
        />
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        <div className="q-actions">
          <button type="button" className="btn btn-block" disabled={!selected || busy} onClick={next}>
            {busy ? 'Working out your result...' : last ? 'See my result' : 'Next question'}
          </button>
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        No time limit. Pick the answer you think is right; you will see the explanations at the end.
      </p>
    </div>
  );
}
