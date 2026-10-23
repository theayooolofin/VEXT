import { A as Link } from '@/components/A';
import { HeroQuestion } from '@/components/HeroQuestion';
import { Rich } from '@/components/Rich';
import { Page } from '@/components/Shell';
import { Track } from '@/components/Track';
import { currentOffer } from '@/lib/checkout';
import { getContent, servableDiagnostic, servableLesson } from '@/lib/content';
import { toPublicQuestion } from '@/lib/contentStore';
import { siteInfo } from '@/lib/page';
import { foundingPlacesLeft, nairaFromKobo } from '@/lib/rules';
import { addDays, formatDay, formatTime, lagosDateTime } from '@/lib/time';

export default async function Landing() {
  const { settings, whatsappUrl } = await siteInfo();
  const offer = await currentOffer(settings);
  const price = nairaFromKobo(offer.priceKobo);
  const diag = servableDiagnostic();
  const heroQ = diag?.questions.find((q) => q.heroEligible) ?? diag?.questions[0];
  const day1 = servableLesson(1);
  const sampleQ = day1?.questions[0];
  const content = getContent();
  const startDate = offer.cohort?.startDate;
  const unlockTime = startDate ? formatTime(lagosDateTime(startDate, settings.unlock_time_local)) : null;
  const placesTaken = settings.founding_cap - foundingPlacesLeft(settings, offer.paid, new Date());

  const days = Array.from({ length: 14 }, (_, i) => {
    const day = i + 1;
    const lesson = servableLesson(day);
    const opens = day >= 4 && startDate ? formatDay(lagosDateTime(addDays(startDate, day - 4), settings.unlock_time_local)) : null;
    return { day, title: lesson?.title ?? content.lessons.get(day)?.data?.title ?? null, servable: Boolean(lesson), opens };
  });

  return (
    <Page>
      <Track />
      <section className="hero" aria-labelledby="headline">
        <h1 id="headline">Practise UTME English for 14 days. Ten minutes a day.</h1>
        <p className="lede">
          Start with a free 5-minute check. See which topic costs you marks, then try Days 1 to 3 free.
        </p>
        {heroQ && <HeroQuestion q={toPublicQuestion(heroQ)} />}
        <p style={{ marginTop: 16 }}>
          <Link href="/check" className="btn btn-block">
            Take the free check
          </Link>
        </p>
        <p className="price-line">
          Full 14-day pack: <span className="hl">{price}</span>. Pay once. No subscription.
        </p>
        {settings.show_founding_counter && offer.founding && (
          <p className="small muted">
            {placesTaken} of {settings.founding_cap} founding places taken.
          </p>
        )}
      </section>

      {day1 && sampleQ && (
        <section aria-labelledby="one-day">
          <h2 id="one-day">What one day looks like</h2>
          <p>A short rule with an example, then 10 questions. Each answer is marked straight away with a one-line reason.</p>
          <div className="rule-card" aria-label="Sample rule">
            <p>
              <strong>Day 1: {day1.title}</strong>
            </p>
            <Rich as="p" text={day1.rule.body ?? ''} />
            {day1.rule.example && (
              <p>
                <em>Example:</em> <Rich text={day1.rule.example} />
              </p>
            )}
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <p className="card-label">Question 1 of 10, marked</p>
            <Rich as="p" text={sampleQ.stem ?? ''} className="stem" />
            <p>
              <strong>Answer: {sampleQ.answer}</strong> ({sampleQ.options[sampleQ.answer]})
            </p>
            <div className="feedback correct">
              <Rich text={sampleQ.explanation ?? ''} />
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="the-days">
        <h2 id="the-days">The 14 days</h2>
        <ol className="steps">
          {days.map((d) => (
            <li key={d.day}>
              {d.servable && d.title ? (
                d.title
              ) : d.day >= 4 && d.opens ? (
                <span className="opens">Opens on {d.opens}</span>
              ) : (
                <span className="opens">Being checked by our teacher</span>
              )}
            </li>
          ))}
        </ol>
        <p className="small muted" style={{ marginTop: 8 }}>
          Days 1 to 3 are free. Days 4 to 14 open one a day{unlockTime ? ` at ${unlockTime}` : ''}, Lagos time.
        </p>
      </section>

      <section aria-labelledby="cost">
        <h2 id="cost">What it costs</h2>
        <ul>
          <li>{price} once for all 14 days. Nothing renews and there is no subscription.</li>
          <li>Days 1 to 3 are free. You only pay if you want Days 4 to 14.</li>
          <li>
            Changed your mind? Ask for a refund within {settings.refund_window_hours} hours after your first paid lesson opens.{' '}
            <Link href="/refunds">How refunds work</Link>.
          </li>
        </ul>
        <p>We cannot promise a score. We give you focused practice and clear explanations.</p>
      </section>

      <section aria-labelledby="faq" className="faq">
        <h2 id="faq">Questions people ask</h2>
        <details className="collapsible">
          <summary>Which phones work?</summary>
          <p>Any phone with a recent browser: Chrome, Samsung Internet or Safari. There is nothing to install.</p>
        </details>
        <details className="collapsible">
          <summary>How much data does a day use?</summary>
          <p>Very little. A lesson is text only, and once a day has opened it stays saved on your phone, so you can reopen it without data.</p>
        </details>
        <details className="collapsible">
          <summary>When do lessons open?</summary>
          <p>
            Day 1 opens as soon as you sign up. Days 2 and 3 open on the next two evenings. Paid days open one a day from the start of your group
            {startDate ? `, beginning ${formatDay(lagosDateTime(startDate, settings.unlock_time_local))}` : ''}. You can catch up at your own pace.
          </p>
        </details>
        <details className="collapsible">
          <summary>Who writes the questions?</summary>
          <p>The questions are original and are checked by an English teacher before they go live. If you spot a mistake, tap “Report a problem” on the question.</p>
        </details>
        <details className="collapsible">
          <summary>Is this from JAMB?</summary>
          <p>No. This site is not affiliated with JAMB.</p>
        </details>
        <details className="collapsible">
          <summary>How do I pay?</summary>
          <p>By card, bank transfer or USSD through Paystack. A parent or teacher can pay for you.</p>
        </details>
        <details className="collapsible">
          <summary>Can I get a refund?</summary>
          <p>
            Yes, within {settings.refund_window_hours} hours after your first paid lesson opens. <Link href="/refunds">Read how</Link>.
          </p>
        </details>
        <details className="collapsible">
          <summary>What do you do with my details?</summary>
          <p>
            We ask only for your first name, phone number and class. We use no advertising trackers. <Link href="/privacy">Read the privacy policy</Link> or{' '}
            <a href={whatsappUrl}>message us on WhatsApp</a>.
          </p>
        </details>
      </section>
    </Page>
  );
}
