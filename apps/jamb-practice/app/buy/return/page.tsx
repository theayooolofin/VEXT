import type { Metadata } from 'next';
import { Page } from '@/components/Shell';
import { ReturnPoller } from '@/components/ReturnPoller';
import { getAccess } from '@/lib/access';
import { lessonsStartMessage } from '@/lib/dayLabels';
import { currentOffer } from '@/lib/checkout';
import { requirePageSession, siteInfo } from '@/lib/page';
import { lagosDateTime } from '@/lib/time';

export const metadata: Metadata = { title: 'Confirming your payment' };

export default async function ReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // Paystack appends both ?reference= and ?trxref=; they carry our reference.
  const reference = (sp.reference ?? sp.trxref ?? '').toUpperCase();
  const session = await requirePageSession(`/buy/return?reference=${encodeURIComponent(reference)}`);
  const { settings, whatsappUrl } = await siteInfo();
  const access = await getAccess(session.student.id);
  const offer = access.active ? null : await currentOffer(settings);
  const startDate = access.active?.cohortStartDate ?? offer?.cohort?.startDate;
  const startLabel = startDate ? lessonsStartMessage(lagosDateTime(startDate, settings.unlock_time_local)) : null;

  return (
    <Page>
      <h1>Your payment</h1>
      {/^JP-[A-Z0-9]{12}$/.test(reference) ? (
        <ReturnPoller reference={reference} whatsappUrl={whatsappUrl} startLabel={startLabel} />
      ) : (
        <p className="alert alert-error">
          This link is missing the payment reference. If you paid, <a href={whatsappUrl}>message us on WhatsApp</a>.
        </p>
      )}
    </Page>
  );
}
