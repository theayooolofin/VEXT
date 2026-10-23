import type { Metadata } from 'next';
import { LegalPage } from '@/components/Legal';
import { SupportForm } from '@/components/SupportForm';
import { pageSession, siteInfo } from '@/lib/page';

export const metadata: Metadata = { title: 'Contact' };

export default async function ContactPage() {
  const [{ support, whatsappUrl }, session] = await Promise.all([siteInfo(), pageSession()]);
  return (
    <LegalPage title="Contact">
      <p>The quickest way to reach us is WhatsApp.</p>
      <p>
        <a href={whatsappUrl} className="btn">
          Message us on WhatsApp
        </a>
      </p>
      <p>
        Email: <a href={`mailto:${support.email}`}>{support.email}</a>
      </p>
      <h2>Send us a message</h2>
      <SupportForm type="question" signedIn={Boolean(session)} whatsappUrl={whatsappUrl} label="Your message" />
    </LegalPage>
  );
}
