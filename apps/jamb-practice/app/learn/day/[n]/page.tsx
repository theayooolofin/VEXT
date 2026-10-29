import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LessonPlayer } from '@/components/LessonPlayer';
import { Page } from '@/components/Shell';
import { currentOffer } from '@/lib/checkout';
import { nextDayMessage } from '@/lib/dayLabels';
import { env } from '@/lib/env';
import { dashboard } from '@/lib/lessons';
import { requirePageSession, siteInfo } from '@/lib/page';
import { nairaFromKobo } from '@/lib/rules';
import '../../learn.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  return { title: `Day ${n}` };
}

export default async function DayPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const day = Number(n);
  if (!Number.isInteger(day) || day < 1 || day > 14) notFound();
  const session = await requirePageSession(`/learn/day/${day}`);
  const { settings, whatsappUrl } = await siteInfo();
  const offer = await currentOffer(settings);
  const price = nairaFromKobo(offer.priceKobo);
  // The lesson itself is fetched by the player from the lesson API, so the
  // service worker can keep it for offline use. Only the schedule is rendered here.
  const { states } = await dashboard(session.student, settings);
  const nextState = day < 14 ? states[day] : undefined;
  const now = new Date();

  return (
    <Page>
      <div className="player">
        <LessonPlayer
          day={day}
          priceLabel={price}
          vapidPublicKey={env().VAPID_PUBLIC_KEY ?? null}
          whatsappUrl={whatsappUrl}
          nextDay={
            nextState
              ? { state: nextState.state, label: nextDayMessage(nextState, now, price) }
              : null
          }
        />
      </div>
    </Page>
  );
}
