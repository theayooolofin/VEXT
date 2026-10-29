'use client';

import { A as Link } from '@/components/A';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, newClientId, track } from '@/client/api';
import { enqueue } from '@/client/offlineQueue';
import type { PublicLesson } from '@/lib/contentSchema';
import { isFirstPassageQuestion } from '@/lib/passages';
import { OptionBubbles, type Letter } from './OptionBubbles';
import { PushPrompt } from './PushPrompt';
import { ReportSheet } from './ReportSheet';
import { renderMarks } from './Rich';

type LessonResponse = {
  lesson: PublicLesson;
  progress: { completed: boolean; score: number | null; maxAttempt: Record<string, number>; firstAnswers: Record<string, Letter> };
};

type Blocked = { code: string; message: string };
type NextInfo = { label: string; href?: string } | null;

type Props = {
  day: number;
  priceLabel: string;
  vapidPublicKey: string | null;
  whatsappUrl: string;
  nextDay: { state: string; label: string } | null;
};

export function LessonPlayer({ day, priceLabel, vapidPublicKey, whatsappUrl, nextDay }: Props) {
  const [data, setData] = useState<LessonResponse | null>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'question' | 'summary'>('intro');
  const [selected, setSelected] = useState<Letter | null>(null);
  // This run's answers, and first-ever answers (which decide the score).
  const [runAnswers, setRunAnswers] = useState<Record<string, Letter>>({});
  const [firstAnswers, setFirstAnswers] = useState<Record<string, Letter>>({});
  const [attemptNos, setAttemptNos] = useState<Record<string, number>>({});
  const [score, setScore] = useState<number | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [firstFinish, setFirstFinish] = useState(false);
  const shownAt = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await api<LessonResponse>(`/api/lessons/${day}`);
      if (cancelled) return;
      if (!r.ok) {
        setBlocked({ code: r.code, message: r.message });
        if (['NOT_YET', 'NEEDS_PAYMENT', 'EXPIRED', 'CONTENT_NOT_READY'].includes(r.code)) track('locked_day_viewed', { day, reason: r.code });
        return;
      }
      const { lesson, progress } = r.data;
      setData(r.data);
      setFirstAnswers(progress.firstAnswers);
      // Continue where the student stopped, or start a fresh run of a finished day.
      const nextAttempt: Record<string, number> = {};
      for (const q of lesson.questions) nextAttempt[q.id] = (progress.maxAttempt[q.id] ?? 0) + 1;
      setAttemptNos(nextAttempt);
      if (!progress.completed) {
        const answered: Record<string, Letter> = {};
        for (const q of lesson.questions) if (progress.firstAnswers[q.id]) answered[q.id] = progress.firstAnswers[q.id]!;
        setRunAnswers(answered);
        const firstOpen = lesson.questions.findIndex((q) => !answered[q.id]);
        setI(firstOpen === -1 ? lesson.questions.length - 1 : firstOpen);
      }
      track('lesson_started', { day });
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  useEffect(() => {
    if (phase !== 'intro') heading.current?.focus();
    shownAt.current = Date.now();
  }, [i, phase]);

  const lesson = data?.lesson;
  const q = lesson?.questions[i];
  const answeredNow = q ? runAnswers[q.id] : undefined;

  const choose = useCallback(
    async (l: Letter) => {
      if (!q || runAnswers[q.id]) return;
      setSelected(l);
      setRunAnswers((a) => ({ ...a, [q.id]: l }));
      setFirstAnswers((f) => (f[q.id] ? f : { ...f, [q.id]: l }));
      const body = {
        questionId: q.id,
        selectedOption: l,
        timeMs: Date.now() - shownAt.current,
        clientId: newClientId(),
        attemptNo: attemptNos[q.id] ?? 1,
      };
      const r = await api(`/api/lessons/${day}/answer`, { body });
      if (!r.ok && (r.status === 0 || r.status >= 500)) {
        await enqueue({ clientId: body.clientId, day, body });
        setSyncNote('Your answers are saved on this phone and will sync when you reconnect.');
      }
    },
    [q, runAnswers, attemptNos, day],
  );

  async function finish() {
    if (!lesson) return;
    setPhase('summary');
    const local = lesson.questions.filter((x) => firstAnswers[x.id] === x.answer).length;
    setScore(local);
    const r = await api<{ score: number; firstTime: boolean }>(`/api/lessons/${day}/complete`, { body: {} });
    if (r.ok) {
      setScore(r.data.score);
      setFirstFinish(r.data.firstTime && day === 1);
      setSyncNote(null);
    } else if (r.status === 0) {
      setSyncNote('You are offline. Your score will be saved when you reconnect and reopen this day.');
    }
  }

  function goNext() {
    if (!lesson) return;
    setSelected(null);
    if (i + 1 < lesson.questions.length) setI(i + 1);
    else void finish();
  }

  function redo() {
    if (!lesson) return;
    setAttemptNos((a) => {
      const n = { ...a };
      for (const x of lesson.questions) n[x.id] = (n[x.id] ?? 1) + (runAnswers[x.id] ? 1 : 0);
      return n;
    });
    setRunAnswers({});
    setSelected(null);
    setI(0);
    setPhase('question');
  }

  // ---------- Blocked states ----------
  if (blocked) {
    return (
      <div className="card">
        <h1>Day {day} of 14</h1>
        {blocked.code === 'NEEDS_PAYMENT' ? (
          <>
            <p>Pay {priceLabel} to unlock Days 4 to 14.</p>
            <Link href="/buy" className="btn btn-block">
              Unlock Days 4 to 14
            </Link>
          </>
        ) : blocked.code === 'NOT_SIGNED_IN' ? (
          <>
            <p>Sign in to open your lessons.</p>
            <Link href="/recover" className="btn">
              Sign in
            </Link>
          </>
        ) : (
          <p>{blocked.message}</p>
        )}
        <p style={{ marginTop: 16 }}>
          <Link href="/learn">Back to your 14 days</Link>
        </p>
      </div>
    );
  }
  if (!lesson || !q) return <p aria-live="polite">Opening Day {day}...</p>;

  const total = lesson.questions.length;
  const passage = q.passageId ? lesson.passages.find((p) => p.id === q.passageId) : undefined;

  // ---------- Intro: the rule card ----------
  if (phase === 'intro') {
    const resumed = Object.keys(runAnswers).length > 0 && !data!.progress.completed;
    return (
      <div>
        <p className="card-label">Day {day} of 14</p>
        <h1>{lesson.title}</h1>
        <p className="muted">Topic: {lesson.topicName}</p>
        <div className="rule-card">
          <p>{renderMarks(lesson.rule.body)}</p>
          {lesson.rule.example && (
            <p>
              <em>Example:</em> {renderMarks(lesson.rule.example)}
            </p>
          )}
        </div>
        <p style={{ marginTop: 20 }}>
          {data!.progress.completed ? (
            <button type="button" className="btn btn-block" onClick={redo}>
              Practise Day {day} again
            </button>
          ) : (
            <button type="button" className="btn btn-block" onClick={() => setPhase('question')}>
              {resumed ? `Continue from question ${i + 1}` : 'Start the 10 questions'}
            </button>
          )}
        </p>
        {data!.progress.completed && (
          <p className="small muted">
            You finished this day with {data!.progress.score} of {total}. Practising again does not change that score.
          </p>
        )}
      </div>
    );
  }

  // ---------- Summary ----------
  if (phase === 'summary') {
    const wrong = lesson.questions.filter((x) => firstAnswers[x.id] && firstAnswers[x.id] !== x.answer);
    const next: NextInfo = day === 14 ? null : nextDay ? { label: nextDay.label, href: nextDay.state === 'open' ? `/learn/day/${day + 1}` : nextDay.state === 'needs_payment' ? '/buy' : undefined } : null;
    return (
      <div>
        <p className="card-label">Day {day} of 14</p>
        <h1 ref={heading} tabIndex={-1}>
          Day {day} done
        </h1>
        <p className="score-big">
          {score} of {total}
        </p>
        <p className="muted">Your score counts your first answer to each question.</p>
        {syncNote && <p className="alert">{syncNote}</p>}
        {wrong.length > 0 && (
          <>
            <h2>Look again at these</h2>
            <ul className="missed">
              {wrong.map((x) => (
                <li key={x.id}>
                  <p>{renderMarks(x.stem)}</p>
                  <p>
                    <span className="tag no">You chose {firstAnswers[x.id]}</span>.{' '}
                    <span className="tag ok">
                      The answer is {x.answer}: {renderMarks(x.options[x.answer])}
                    </span>
                  </p>
                  <p className="muted">{renderMarks(x.explanation)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="stack" style={{ marginTop: 20 }}>
          {day === 14 ? (
            <p>
              <strong>You finished all 14 days.</strong> Go back over any day at your own pace.
            </p>
          ) : next?.href ? (
            <Link href={next.href} className="btn btn-block">
              {next.label}
            </Link>
          ) : next ? (
            <p className="alert">{next.label}</p>
          ) : null}
          <Link href="/learn" className="btn btn-secondary btn-block">
            Back to your 14 days
          </Link>
        </div>
        {firstFinish && <PushPrompt vapidPublicKey={vapidPublicKey} whatsappUrl={whatsappUrl} />}
      </div>
    );
  }

  // ---------- Question ----------
  const shown = selected ?? answeredNow ?? null;
  const isAnswered = Boolean(answeredNow);
  const correct = shown === q.answer;
  return (
    <div>
      <div className="progress-head">
        <span>Day {day} of 14</span>
        <span>
          Question {i + 1} of {total}
        </span>
      </div>
      <div className="progress" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={i + 1}>
        <span style={{ width: `${((i + 1) / total) * 100}%` }} />
      </div>
      <details className="collapsible">
        <summary>Today&apos;s rule</summary>
        <div className="rule-card">
          <p>{renderMarks(lesson.rule.body)}</p>
          {lesson.rule.example && (
            <p>
              <em>Example:</em> {renderMarks(lesson.rule.example)}
            </p>
          )}
        </div>
      </details>
      {passage && (
        <details className="collapsible passage" key={q.id} open={isFirstPassageQuestion(lesson.questions, i)}>
          <summary>{passage.title || 'Read the passage'}</summary>
          <p>{renderMarks(passage.body)}</p>
        </details>
      )}
      <div className="question-card fade-in" key={`${q.id}-${attemptNos[q.id]}`}>
        <h2 ref={heading} tabIndex={-1} className="sr-only">
          Question {i + 1} of {total}
        </h2>
        <p className="stem">{renderMarks(q.stem)}</p>
        <OptionBubbles name={q.id} legend="Choose an answer" options={q.options} selected={shown} correct={isAnswered ? q.answer : null} onSelect={choose} />
        <div aria-live="polite">
          {isAnswered && (
            <div className={`feedback fade-in ${correct ? 'correct' : 'wrong'}`}>
              <strong>{correct ? 'Correct.' : `Not quite. The answer is ${q.answer}.`}</strong>
              {renderMarks(q.explanation)}
            </div>
          )}
        </div>
        {syncNote && <p className="small muted">{syncNote}</p>}
        <div className="q-actions">
          <button type="button" className="btn" disabled={!isAnswered} onClick={goNext}>
            {i + 1 < total ? 'Next question' : 'See my score'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setReportFor(q.id)}>
            Report a problem
          </button>
        </div>
      </div>
      {reportFor && (
        <ReportSheet
          day={day}
          questionId={reportFor}
          onClose={(sent) => {
            setReportFor(null);
            if (sent) {
              setToast('Thank you. A teacher will check it.');
              setTimeout(() => setToast(null), 4000);
            }
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
