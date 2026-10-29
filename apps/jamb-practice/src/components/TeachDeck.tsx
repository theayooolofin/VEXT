'use client';

import { A as Link } from '@/components/A';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { OPTION_KEYS, type OptionKey, type PublicLesson } from '@/lib/contentSchema';
import { questionStep, stepForKey, teachSteps } from '@/lib/teachSteps';
import { renderMarks } from './Rich';

/**
 * Teach mode: a day projected for a class. The teacher reads each question,
 * optionally taps the option the class chose, then shows the answer.
 */
export function TeachDeck({ lesson, notServed }: { lesson: PublicLesson; notServed: boolean }) {
  const steps = teachSteps(lesson.questions.length);
  const [at, setAt] = useState(0);
  const [picks, setPicks] = useState<Record<string, OptionKey>>({});
  const step = steps[at]!;
  const last = steps.length - 1;

  const go = useCallback((n: number) => setAt(Math.max(0, Math.min(n, last))), [last]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      // Let Space and Enter press a focused button; everything else drives the deck.
      if ((e.key === ' ' || e.key === 'Enter') && target?.closest('button, a')) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => {});
        return;
      }
      const next = stepForKey(e.key, at, steps);
      if (next === null) return;
      e.preventDefault();
      go(next);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [at, steps, go]);

  const q = step.kind === 'question' ? lesson.questions[step.index]! : null;
  const revealed = step.kind === 'question' && step.revealed;
  const passage = q?.passageId ? lesson.passages.find((p) => p.id === q.passageId) : undefined;
  const total = lesson.questions.length;

  const status =
    step.kind === 'title'
      ? `${lesson.questions.length} questions`
      : step.kind === 'rule'
        ? 'The rule'
        : step.kind === 'key'
          ? 'Answer key'
          : `Question ${step.index + 1} of ${total}`;

  const nextLabel =
    step.kind === 'title'
      ? 'Start'
      : step.kind === 'rule'
        ? 'First question'
        : step.kind === 'key'
          ? null
          : !revealed
            ? 'Show answer'
            : step.index === total - 1
              ? 'Answer key'
              : 'Next question';

  function pick(letter: OptionKey) {
    if (!q || revealed) return;
    setPicks((p) => (p[q.id] === letter ? omit(p, q.id) : { ...p, [q.id]: letter }));
  }

  return (
    <div className="teach">
      <header className="teach-top">
        <p className="teach-day">
          <strong>Day {lesson.day}</strong> <span>{lesson.title}</span>
        </p>
        <p className="teach-where" aria-live="polite">
          {revealed && q ? `${status}: the answer is ${q.answer}` : status}
        </p>
        <Link href="/admin/teach" className="teach-exit">
          Exit
        </Link>
      </header>

      <main
        className={`teach-stage${passage ? ' has-passage' : ''}`}
        key={step.kind === 'question' ? step.index : step.kind}
      >
        {step.kind === 'title' && (
          <section className="teach-title">
            <p className="teach-bignum" aria-hidden="true">
              {lesson.day}
            </p>
            <div>
              <h1>{lesson.title}</h1>
              <p className="teach-lead">
                {total} questions on {lesson.topicName}. Read each one aloud, let the class answer,
                then show the answer.
              </p>
              {notServed && (
                <p className="teach-note">
                  Students cannot see this day yet: it is waiting for a teacher&apos;s approval.
                </p>
              )}
            </div>
          </section>
        )}

        {step.kind === 'rule' && (
          <section className="teach-rule">
            <h1>Today&apos;s rule</h1>
            <p className="teach-rule-body">{renderMarks(lesson.rule.body)}</p>
            {lesson.rule.example && (
              <p className="teach-example">
                <span>For example:</span> {renderMarks(lesson.rule.example)}
              </p>
            )}
          </section>
        )}

        {q && (
          <>
            {passage && (
              <section className="teach-passage" aria-label="Passage">
                <h2>{passage.title || 'Read the passage'}</h2>
                <p>{renderMarks(passage.body)}</p>
              </section>
            )}
            <section className="teach-question">
              <h1 className="teach-stem">
                <span className="teach-qnum">{step.kind === 'question' ? step.index + 1 : ''}</span>
                <span>{renderMarks(q.stem)}</span>
              </h1>
              <ul className="teach-options">
                {OPTION_KEYS.map((letter) => {
                  const picked = picks[q.id] === letter;
                  const right = revealed && q.answer === letter;
                  const wrong = revealed && picked && q.answer !== letter;
                  return (
                    <li key={letter}>
                      <button
                        type="button"
                        className={`teach-option${picked ? ' is-picked' : ''}${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}`}
                        aria-pressed={picked}
                        disabled={revealed}
                        onClick={() => pick(letter)}
                      >
                        <span className="teach-letter">{letter}</span>
                        <span className="teach-option-text">{q.options[letter]}</span>
                        {right && <PenRing />}
                        {wrong && <PenCross />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {revealed && (
                <p className="teach-why">
                  <strong>{q.answer}.</strong> {renderMarks(q.explanation)}
                </p>
              )}
            </section>
          </>
        )}

        {step.kind === 'key' && (
          <section className="teach-key">
            <h1>Answer key</h1>
            <ol>
              {lesson.questions.map((x, i) => {
                const p = picks[x.id];
                return (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => go(questionStep(i))}
                      aria-label={`Question ${i + 1}: ${x.answer}. Open question ${i + 1}`}
                    >
                      <span className="teach-key-n">{i + 1}</span>
                      <span className="teach-key-a">{x.answer}</span>
                      {p && (
                        <span className={p === x.answer ? 'teach-key-ok' : 'teach-key-no'}>
                          {p === x.answer ? 'class right' : `class said ${p}`}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </main>

      <footer className="teach-bar">
        <button
          type="button"
          className="teach-btn teach-btn-quiet"
          onClick={() => go(at - 1)}
          disabled={at === 0}
        >
          Back
        </button>
        <nav className="teach-dots" aria-label="Questions">
          {lesson.questions.map((x, i) => {
            const here = step.kind === 'question' && step.index === i;
            const done = at > questionStep(i) + 1;
            return (
              <button
                key={x.id}
                type="button"
                className={`teach-dot${here ? ' is-here' : ''}${done ? ' is-done' : ''}`}
                aria-current={here ? 'step' : undefined}
                aria-label={`Question ${i + 1}`}
                onClick={() => go(questionStep(i))}
              >
                {i + 1}
              </button>
            );
          })}
        </nav>
        {nextLabel ? (
          <button type="button" className="teach-btn" onClick={() => go(at + 1)}>
            {nextLabel}
            <kbd aria-hidden="true">Space</kbd>
          </button>
        ) : (
          <button type="button" className="teach-btn teach-btn-quiet" onClick={() => go(0)}>
            Start again
          </button>
        )}
      </footer>
      <p className="teach-keys">
        Space or the right arrow moves on, the left arrow goes back, 1 to 0 jump to a question, F
        fills the screen.
      </p>
    </div>
  );
}

function omit<T extends Record<string, unknown>>(o: T, k: string): T {
  const copy = { ...o };
  delete copy[k];
  return copy;
}

/** The teacher's red pen circling the right answer. */
function PenRing() {
  const ref = useRef<SVGPathElement>(null);
  // The ring stretches to fit the option, so the pen stroke is drawn over its
  // length on screen, not its length in the drawing.
  useLayoutEffect(() => {
    const path = ref.current;
    const ctm = path?.getScreenCTM();
    if (!path || !ctm) return;
    const total = path.getTotalLength();
    let len = 0;
    let prev: DOMPoint | null = null;
    for (let i = 0; i <= 48; i++) {
      const pt = path.getPointAtLength((total * i) / 48).matrixTransform(ctm);
      if (prev) len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      prev = pt;
    }
    path.style.setProperty('--len', `${Math.ceil(len)}px`);
  }, []);
  return (
    <svg className="teach-ring" viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true">
      <path
        ref={ref}
        d="M62 6 C 26 4, 4 16, 6 32 C 8 50, 44 57, 74 54 C 104 51, 118 40, 114 24 C 110 10, 84 3, 52 8"
      />
    </svg>
  );
}

function PenCross() {
  return (
    <svg className="teach-cross" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M6 6 L22 22 M22 6 L6 22" />
    </svg>
  );
}
