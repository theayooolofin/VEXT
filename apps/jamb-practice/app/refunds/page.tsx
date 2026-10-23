// LEGAL DRAFT: review before launch.
import type { Metadata } from 'next';
import { LegalPage } from '@/components/Legal';
import { SupportForm } from '@/components/SupportForm';
import { pageSession, siteInfo } from '@/lib/page';

export const metadata: Metadata = { title: 'Refunds' };

export default async function RefundsPage() {
  const [{ settings, whatsappUrl }, session] = await Promise.all([siteInfo(), pageSession()]);
  return (
    <LegalPage title="Refunds">
      <p>
        If the course is not for you, ask for a refund within {settings.refund_window_hours} hours after your first paid lesson (Day 4) opens. You get the
        full amount back.
      </p>
      <h2>How to ask</h2>
      <ol>
        <li>
          Send the form below, or <a href={whatsappUrl}>message us on WhatsApp</a>.
        </li>
        <li>We check your payment and refund the full amount through Paystack, usually within one working day of your request.</li>
        <li>The money can take a few more working days to reach you, depending on your bank.</li>
      </ol>
      <p>Your access to Days 4 to 14 ends when the refund is made.</p>
      <h2>Ask for a refund</h2>
      <SupportForm type="refund" signedIn={Boolean(session)} whatsappUrl={whatsappUrl} label="Anything we should know (optional)" />
    </LegalPage>
  );
}
