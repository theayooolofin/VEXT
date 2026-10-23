import { desc, eq, or } from 'drizzle-orm';
import type { Metadata } from 'next';
import { A as Link } from '@/components/A';
import { getDb, schema } from '@/db';
import { Rich } from '@/components/Rich';
import { Page } from '@/components/Shell';
import { Track } from '@/components/Track';
import { getContent, servableDiagnostic } from '@/lib/content';
import { pageAnonId, pageSession, siteInfo } from '@/lib/page';

export const metadata: Metadata = { title: 'Your result' };

export default async function ResultPage() {
  const [anonId, session, { settings }] = await Promise.all([pageAnonId(), pageSession(), siteInfo()]);
  const db = await getDb();
  const conds = [anonId ? eq(schema.diagnosticAttempts.anonId, anonId) : undefined, session ? eq(schema.diagnosticAttempts.studentId, session.student.id) : undefined].filter(
    (c) => c !== undefined,
  );
  const attempt = conds.length
    ? await db.query.diagnosticAttempts.findFirst({ where: or(...conds), orderBy: desc(schema.diagnosticAttempts.createdAt) })
    : undefined;
  const topics = getContent().topics;
  const name = (t: string | null) => (t ? (topics[t] ?? t) : '');

  if (!attempt) {
    return (
      <Page>
        <h1>Your result</h1>
        <p>We could not find a finished check on this phone.</p>
        <Link href="/check" className="btn">
          Take the free check
        </Link>
      </Page>
    );
  }

  const signedIn = Boolean(session);
  const hideResult = settings.gate_result_behind_signup && !signedIn;
  const diag = servableDiagnostic();
  const missed = (diag?.questions ?? []).filter((q) => attempt.answers[q.id] !== q.answer);
  const signupCta = (
    <Link href="/start" className="btn btn-block">
      Save my result and start Day 1
    </Link>
  );

  return (
    <Page>
      <Track />
      <h1>Your result</h1>
      {hideResult ? (
        <>
          <p>Your result is ready. Sign up to see your score, the topic to work on first, and the explanations.</p>
          {signupCta}
        </>
      ) : (
        <>
          <p className="score-big">
            You got {attempt.score} out of {Object.values(attempt.topicScores).reduce((n, t) => n + t.asked, 0)}.
          </p>
          {attempt.weakestTopic && (
            <p>
              {attempt.score === 10 ? (
                <>Every answer was right. Day 1 starts with {name(attempt.weakestTopic)}.</>
              ) : (
                <>
                  Your weakest topic was <span className="hl">{name(attempt.weakestTopic)}</span>. Day 1 starts there.
                </>
              )}
            </p>
          )}
          <h2>By topic</h2>
          <ul className="breakdown">
            {Object.entries(attempt.topicScores).map(([t, s]) => (
              <li key={t}>
                <span>{name(t)}</span>
                <span>
                  {s.correct} of {s.asked} right
                </span>
              </li>
            ))}
          </ul>
          {signedIn ? (
            <>
              {missed.length > 0 && (
                <>
                  <h2>The ones you missed</h2>
                  <ul className="missed">
                    {missed.map((q) => (
                      <li key={q.id}>
                        <Rich as="p" text={q.stem ?? ''} />
                        <p>
                          <span className="tag no">Your answer: {attempt.answers[q.id] ?? 'none'}</span>.{' '}
                          <span className="tag ok">
                            Right answer: {q.answer} ({q.options[q.answer]})
                          </span>
                        </p>
                        <Rich as="p" text={q.explanation ?? ''} className="muted" />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p style={{ marginTop: 20 }}>
                <Link href="/learn/day/1" className="btn btn-block">
                  Start Day 1
                </Link>
              </p>
            </>
          ) : (
            <>
              <p>Sign up to see the explanations for the questions you missed and to start Day 1 free.</p>
              {signupCta}
            </>
          )}
        </>
      )}
    </Page>
  );
}
