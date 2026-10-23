import type { Metadata } from 'next';
import { A as Link } from '@/components/A';
import { BuyButton } from '@/components/BuyButton';
import { Page } from '@/components/Shell';
import { Track } from '@/components/Track';
import { getAccess } from '@/lib/access';
import { currentOffer, paymentEmail } from '@/lib/checkout';
import { lessonsStartMessage } from '@/lib/dayLabels';
import { requirePageSession, siteInfo } from '@/lib/page';
import { foundingPlacesLeft, nairaFromKobo } from '@/lib/rules';
import { formatLongDay, lagosDateTime } from '@/lib/time';

export const metadata: Metadata = { title: 'Unlock Days 4 to 14' };

export default async function BuyPage() {
  const session = await requirePageSession('/buy');
  const { settings, whatsappUrl } = await siteInfo();
  const [offer, access] = await Promise.all([currentOffer(settings), getAccess(session.student.id)]);
  const price = nairaFromKobo(offer.priceKobo);

  if (access.active) {
    return (
      <Page>
        <h1>You have the full pack</h1>
        <p>{lessonsStartMessage(lagosDateTime(access.active.cohortStartDate, settings.unlock_time_local))}</p>
        <Link href="/learn" className="btn">
          Open my 14 days
        </Link>
      </Page>
    );
  }

  if (!offer.cohort) {
    return (
      <Page>
        <Track />
        <h1>Unlock Days 4 to 14</h1>
        <p>Enrolment is closed for now. Message us on WhatsApp to be told when the next group opens.</p>
        <a href={whatsappUrl} className="btn">
          Message us on WhatsApp
        </a>
      </Page>
    );
  }

  const start = lagosDateTime(offer.cohort.startDate, settings.unlock_time_local);
  const left = foundingPlacesLeft(settings, offer.paid, new Date());
  return (
    <Page>
      <Track />
      <h1>Unlock Days 4 to 14</h1>
      <div className="card">
        <p className="score-big">
          <span className="hl">{price}</span>
        </p>
        <p>Pay once. No subscription. Nothing renews.</p>
        <ul>
          <li>Days 4 to 14: one lesson a day, about 10 minutes each.</li>
          <li>
            Your group starts on {formatLongDay(start)}. Day 4 opens that evening and one more day opens each evening after.
          </li>
          <li>Catch up at your own pace. Your access lasts {offer.product?.accessDays ?? 90} days from the start.</li>
          <li>
            Refund within {settings.refund_window_hours} hours after Day 4 opens if it is not for you. <Link href="/refunds">How refunds work</Link>.
          </li>
        </ul>
        {settings.show_founding_counter && offer.founding && (
          <p className="small muted">
            {settings.founding_cap - left} of {settings.founding_cap} founding places taken.
          </p>
        )}
        <BuyButton needsEmail={!paymentEmail(session.student)} priceLabel={price} />
        <p className="small muted" style={{ marginTop: 12 }}>
          You pay on Paystack by card, bank transfer or USSD. We never see your card details.
        </p>
      </div>
      <p style={{ marginTop: 16 }}>We cannot promise a score. We give you focused practice and clear explanations.</p>
    </Page>
  );
}
