'use client';

import { A as Link } from '@/components/A';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/client/api';
import type { ActiveMock, MockResult } from '@/lib/mockRepo';
import { isFirstPassageQuestion } from '@/lib/passages';
import { OptionBubbles, type Letter } from './OptionBubbles';
import { renderMarks } from './Rich';

// Dates arrive as strings over JSON.
type Mock = Omit<ActiveMock, 'startedAt' | 'deadlineAt'> & {
  startedAt: string;
  deadlineAt: string;
};
type PageData = {
  available: boolean;
  questions: number;
  minutes: number;
  active: Mock | null;
  history: { id: string; score: number; total: number; submittedAt: string }[];
  serverTime: string;
};
type Saved = { answers: Record<string, Letter>; flags: string[] };

const LETTERS: Letter[] = ['A', 'B', 'C', 'D'];
const storeKey = (id: string) => `jp_mock_${id}`;

function load(id: string): Saved {
  try {
    const raw = localStorage.getItem(storeKey(id));
    if (raw) return JSON.parse(raw) as Saved;
  } catch {
    /* private mode or cleared storage: start empty */
  }
  return { answers: {}, flags: [] };
}

function save(id: string, s: Saved) {
  try {
    localStorage.setItem(storeKey(id), JSON.stringify(s));
  } catch {
    /* answers still live in memory until submit */
  }
}

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function MockPlayer() {
  const [page, setPage] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mock, setMock] = useState<Mock | null>(null);
  const [offset, setOffset] = useState(0); // server clock minus this device's clock
  const [answers, setAnswers] = useState<Record<string, Letter>>({});
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [i, setI] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MockResult | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmBox = useRef<HTMLDivElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    void api<PageData>('/api/mock').then((r) => {
      if (!r.ok) return setError(r.message);
      setPage(r.data);
      setOffset(new Date(r.data.serverTime).getTime() - Date.now());
    });
  }, []);

  const begin = useCallback((m: Mock, serverTime: string) => {
    const saved = load(m.id);
    setOffset(new Date(serverTime).getTime() - Date.now());
    setAnswers(saved.answers);
    setFlags(new Set(saved.flags));
    setMock(m);
    setI(0);
  }, []);

  async function start() {
    setBusy(true);
    const r = await api<{ mock: Mock; serverTime: string }>('/api/mock/start', { body: {} });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    begin(r.data.mock, r.data.serverTime);
  }

  const submit = useCallback(async () => {
    if (!mock || submitted.current) return;
    submitted.current = true;
    setBusy(true);
    const r = await api<MockResult>('/api/mock/submit', { body: { attemptId: mock.id, answers } });
    setBusy(false);
    if (!r.ok) {
      submitted.current = false;
      setConfirming(false);
      return setError(`${r.message} Your answers are kept on this phone; try again.`);
    }
    try {
      localStorage.removeItem(storeKey(mock.id));
    } catch {
      /* nothing to clear */
    }
    setResult(r.data);
    setMock(null);
    window.scrollTo(0, 0);
  }, [mock, answers]);

  // The clock, and submitting when time runs out.
  const remaining = mock ? new Date(mock.deadlineAt).getTime() - (now + offset) : 0;
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);
  useEffect(() => {
    if (!mock) return;
    const deadline = new Date(mock.deadlineAt).getTime();
    const tick = () => {
      setNow(Date.now());
      if (deadline - (Date.now() + offset) <= 0) void submitRef.current();
    };
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [mock, offset]);

  useEffect(() => {
    if (mock) save(mock.id, { answers, flags: [...flags] });
  }, [mock, answers, flags]);

  const q = mock?.questions[i];
  const total = mock?.questions.length ?? 0;
  const go = useCallback((n: number) => setI(Math.max(0, Math.min(n, total - 1))), [total]);
  const choose = useCallback((l: Letter) => q && setAnswers((a) => ({ ...a, [q.id]: l })), [q]);
  const toggleFlag = useCallback(
    () =>
      q &&
      setFlags((f) => {
        const n = new Set(f);
        if (n.has(q.id)) n.delete(q.id);
        else n.add(q.id);
        return n;
      }),
    [q],
  );

  // The exam keys: A to D answer, N and P move, F flags, S asks to submit.
  useEffect(() => {
    if (!mock || confirming) return;
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input[type=text], textarea')) return;
      // On an answer, the arrows move between its options as usual.
      if (e.key.startsWith('Arrow') && target?.matches('input[type=radio]')) return;
      const k = e.key.toUpperCase();
      if ((LETTERS as string[]).includes(k)) choose(k as Letter);
      else if (k === 'N' || e.key === 'ArrowRight') go(i + 1);
      else if (k === 'P' || e.key === 'ArrowLeft') go(i - 1);
      else if (k === 'F') toggleFlag();
      else if (k === 'S') setConfirming(true);
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mock, confirming, i, go, choose, toggleFlag]);

  useEffect(() => heading.current?.focus(), [i, result]);
  // The submit check sits above the question, so bring it into view when it opens.
  useEffect(() => {
    if (!confirming) return;
    confirmBox.current?.scrollIntoView({ block: 'center' });
    confirmBox.current?.focus();
  }, [confirming]);

  if (error && !mock) {
    return (
      <div>
        <h1>Timed mock</h1>
        <p className="alert">{error}</p>
        <p>
          <Link href="/learn">Back to your 14 days</Link>
        </p>
      </div>
    );
  }

  // ---------- Results ----------
  if (result) return <MockResultView result={result} headingRef={heading} />;

  // ---------- Start ----------
  if (!mock) {
    if (!page) return <p aria-live="polite">Opening the mock...</p>;
    return (
      <div>
        <p className="card-label">Timed mock</p>
        <h1>Practise under exam conditions</h1>
        {page.available ? (
          <>
            <ul className="mock-facts">
              <li>
                <strong>{page.questions} questions</strong> from the days you have opened, set out
                like the UTME English paper.
              </li>
              <li>
                <strong>{page.minutes} minutes.</strong> The clock keeps running if you leave the
                page.
              </li>
              <li>
                Move between questions, flag any to come back to, and change an answer until you
                submit.
              </li>
              <li>Your answers are marked when you submit, with a score for each topic.</li>
            </ul>
            <p className="small muted">
              On a keyboard: A to D answer, N next, P previous, F flag, S submit.
            </p>
            <button
              type="button"
              className="btn btn-block"
              onClick={() => (page.active ? begin(page.active, page.serverTime) : void start())}
              disabled={busy}
            >
              {page.active ? 'Continue your mock' : 'Start the mock'}
            </button>
          </>
        ) : (
          <p className="alert">
            The mock opens once Day 2 is open, so it has at least 20 questions to draw on. You have{' '}
            {page.questions} so far.
          </p>
        )}
        {page.history.length > 0 && (
          <>
            <h2 style={{ marginTop: 28 }}>Your past mocks</h2>
            <ul className="breakdown">
              {page.history.map((h) => (
                <li key={h.id}>
                  <span>
                    {new Date(h.submittedAt).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'Africa/Lagos',
                    })}
                  </span>
                  <strong>
                    {h.score} of {h.total}
                  </strong>
                </li>
              ))}
            </ul>
          </>
        )}
        <p style={{ marginTop: 20 }}>
          <Link href="/learn">Back to your 14 days</Link>
        </p>
      </div>
    );
  }

  // ---------- The exam ----------
  const passage = q?.passageId ? mock.passages.find((p) => p.id === q.passageId) : undefined;
  const answeredCount = mock.questions.filter((x) => answers[x.id]).length;
  const low = remaining < 5 * 60_000;
  return (
    <div className="mock">
      <div className="mock-bar">
        <span>
          Question {i + 1} of {total}
        </span>
        <span
          className={`mock-clock${low ? ' is-low' : ''}`}
          role="timer"
          aria-label={`Time left ${clock(remaining)}`}
        >
          {clock(remaining)}
        </span>
        <button type="button" className="btn btn-quiet" onClick={() => setConfirming(true)}>
          Submit
        </button>
      </div>

      {confirming && (
        <div
          className="mock-confirm"
          role="alertdialog"
          aria-labelledby="mock-confirm-title"
          ref={confirmBox}
          tabIndex={-1}
        >
          <p id="mock-confirm-title">
            <strong>
              Submit with {answeredCount} of {total} answered?
            </strong>
          </p>
          {total - answeredCount > 0 && <p>Unanswered questions count as wrong.</p>}
          {flags.size > 0 && <p>You flagged {flags.size} to come back to.</p>}
          <div className="stack">
            <button
              type="button"
              className="btn btn-block"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? 'Marking...' : 'Submit and see my score'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Keep going
            </button>
          </div>
        </div>
      )}
      {error && <p className="alert alert-error">{error}</p>}

      {passage && q && (
        <details
          className="collapsible passage"
          key={q.id}
          open={isFirstPassageQuestion(mock.questions, i)}
        >
          <summary>{passage.title || 'Read the passage'}</summary>
          <p>{renderMarks(passage.body)}</p>
        </details>
      )}
      {q && (
        <div className="question-card" key={q.id}>
          <h2 ref={heading} tabIndex={-1} className="sr-only">
            Question {i + 1} of {total}
          </h2>
          <p className="stem">{renderMarks(q.stem)}</p>
          <OptionBubbles
            name={`mock-${q.id}`}
            legend="Choose an answer"
            options={q.options}
            selected={answers[q.id] ?? null}
            correct={null}
            onSelect={choose}
            markResult={false}
          />
          <div className="mock-nav">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => go(i - 1)}
              disabled={i === 0}
            >
              Previous
            </button>
            <button
              type="button"
              className={`btn btn-quiet mock-flag${flags.has(q.id) ? ' is-on' : ''}`}
              aria-pressed={flags.has(q.id)}
              onClick={toggleFlag}
            >
              {flags.has(q.id) ? 'Flagged' : 'Flag'}
            </button>
            {i + 1 < total ? (
              <button type="button" className="btn" onClick={() => go(i + 1)}>
                Next
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => setConfirming(true)}>
                Submit
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="mock-palette" aria-label="All questions">
        {mock.questions.map((x, n) => (
          <button
            key={x.id}
            type="button"
            className={`mock-cell${answers[x.id] ? ' is-answered' : ''}${flags.has(x.id) ? ' is-flagged' : ''}${n === i ? ' is-here' : ''}`}
            aria-current={n === i ? 'step' : undefined}
            aria-label={`Question ${n + 1}${answers[x.id] ? ', answered' : ''}${flags.has(x.id) ? ', flagged' : ''}`}
            onClick={() => go(n)}
          >
            {n + 1}
          </button>
        ))}
      </nav>
      <p className="small muted">
        {answeredCount} of {total} answered{flags.size ? `, ${flags.size} flagged` : ''}.
      </p>
    </div>
  );
}

function MockResultView({
  result,
  headingRef,
}: {
  result: MockResult;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [onlyMissed, setOnlyMissed] = useState(true);
  const topics = Object.entries(result.topicScores).sort(
    (a, b) => a[1].correct / a[1].asked - b[1].correct / b[1].asked,
  );
  const review = result.review
    .map((r, n) => ({ ...r, n: n + 1 }))
    .filter((r) => !onlyMissed || r.chosen !== r.answer);
  const name = (t: string) => result.topicNames[t] ?? t;
  return (
    <div>
      <p className="card-label">Timed mock</p>
      <h1 ref={headingRef} tabIndex={-1}>
        Mock marked
      </h1>
      <p className="score-big score-mark">
        {result.score} of {result.total}
      </p>
      <p className="muted">
        You answered {result.answered} of {result.total}.
        {result.late
          ? ' The time ran out before your answers reached us, so this mock is marked as late.'
          : ''}
      </p>
      {result.weakestTopic && (
        <p className="alert">
          Your weakest topic was <strong>{name(result.weakestTopic)}</strong>.
          {result.weakestDay && (
            <>
              {' '}
              <Link href={`/learn/day/${result.weakestDay}`}>Go over Day {result.weakestDay}</Link>.
            </>
          )}
        </p>
      )}
      <h2>By topic</h2>
      <ul className="breakdown">
        {topics.map(([t, s]) => (
          <li key={t}>
            <span>{name(t)}</span>
            <span>
              {s.correct} of {s.asked} right
            </span>
          </li>
        ))}
      </ul>

      <h2 style={{ marginTop: 24 }}>Go over your answers</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={onlyMissed}
          onChange={(e) => setOnlyMissed(e.target.checked)}
        />
        <span>Show only the ones I got wrong or left blank</span>
      </label>
      {review.length === 0 && <p className="muted">Nothing to go over: every answer was right.</p>}
      <ul className="missed">
        {review.map((r) => {
          const passage = r.passageId
            ? result.passages.find((p) => p.id === r.passageId)
            : undefined;
          return (
            <li key={r.id}>
              <p>
                <strong>{r.n}.</strong> {passage ? <em>({passage.title || 'Passage'}) </em> : null}
                {renderMarks(r.stem)}
              </p>
              <p>
                {r.chosen === r.answer ? (
                  <span className="tag ok">You chose {r.chosen}: right.</span>
                ) : (
                  <>
                    <span className="tag no">
                      {r.chosen ? `You chose ${r.chosen}` : 'You left it blank'}
                    </span>
                    .{' '}
                    <span className="tag ok">
                      The answer is {r.answer}: {renderMarks(r.options[r.answer])}
                    </span>
                  </>
                )}
              </p>
              <p className="muted">{renderMarks(r.explanation)}</p>
            </li>
          );
        })}
      </ul>
      <div className="stack" style={{ marginTop: 20 }}>
        <Link href="/learn/mock" className="btn btn-secondary btn-block">
          Take another mock
        </Link>
        <Link href="/learn" className="btn btn-quiet btn-block">
          Back to your 14 days
        </Link>
      </div>
    </div>
  );
}
