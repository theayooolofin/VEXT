import type { Metadata } from 'next';
import { A as Link } from '@/components/A';
import { Page } from '@/components/Shell';
import { Track } from '@/components/Track';
import { currentOffer } from '@/lib/checkout';
import { dayLabel, lessonsStartMessage } from '@/lib/dayLabels';
import { dashboard } from '@/lib/lessons';
import { requirePageSession, siteInfo } from '@/lib/page';
import { nairaFromKobo } from '@/lib/rules';
import { nextAction } from '@/lib/unlock';

export const metadata: Metadata = { title: 'Your 14 days' };

export default async function LearnPage() {
  const session = await requirePageSession('/learn');
  const { settings } = await siteInfo();
  const { states, titles, access } = await dashboard(session.student, settings);
  const offer = await currentOffer(settings);
  const price = nairaFromKobo(offer.priceKobo);
  const next = nextAction(states);
  const day4 = states[3]!;
  const paidNotStarted = access.active && day4.state === 'locked';
  const needsPayment = day4.state === 'needs_payment';

  return (
    <Page>
      <Track />
      <h1>Your 14 days</h1>
      {paidNotStarted && day4.state === 'locked' && <p className="alert alert-ok">{lessonsStartMessage(day4.unlocksAt)}</p>}
      {next?.state === 'open' ? (
        <p>
          <Link href={`/learn/day/${next.day}`} className="btn btn-block">
            Start Day {next.day}
          </Link>
        </p>
      ) : next?.state === 'locked' ? (
        <p className="alert">
          Day {next.day} {dayLabel(next).replace(/^Opens/, 'opens')}.
        </p>
      ) : null}
      {needsPayment && (
        <div className="card" style={{ margin: '16px 0' }}>
          <p>
            <strong>Pay {price} to unlock Days 4 to 14.</strong> Pay once. No subscription.
          </p>
          <Link href="/buy" className="btn btn-secondary btn-block">
            Unlock Days 4 to 14
          </Link>
        </div>
      )}
      <ol className="days" aria-label="The 14 days">
        {states.map((s) => {
          const title = titles.get(s.day) ?? `Day ${s.day}`;
          const inner = (
            <>
              <span className="day-num" aria-hidden="true">
                {s.day}
              </span>
              <span className="day-main">
                <span className="day-title">
                  <span className="sr-only">Day {s.day}: </span>
                  {title}
                </span>
                <span className="day-state">{dayLabel(s)}</span>
              </span>
            </>
          );
          const linkable = s.state === 'open' || s.state === 'done';
          const href = linkable ? `/learn/day/${s.day}` : s.state === 'needs_payment' ? '/buy' : null;
          return (
            <li key={s.day}>
              {href ? (
                <Link href={href} className={`day-row ${s.state}`}>
                  {inner}
                </Link>
              ) : (
                <div className={`day-row ${s.state}`}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </Page>
  );
}
