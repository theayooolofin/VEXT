// LEGAL DRAFT: review before launch.
import type { Metadata } from 'next';
import { A as Link } from '@/components/A';
import { LegalPage } from '@/components/Legal';
import { env } from '@/lib/env';
import { siteInfo } from '@/lib/page';

export const metadata: Metadata = { title: 'Privacy policy' };

export default async function PrivacyPage() {
  const { productName, support, whatsappUrl } = await siteInfo();
  const operator = env().LEGAL_BUSINESS_NAME || `the operator of ${productName}`;
  const privacyEmail = env().PRIVACY_CONTACT_EMAIL || support.email;
  return (
    <LegalPage title="Privacy policy">
      <p>
        This page explains what {productName} collects, why, and what you can do about it. {productName} is run by {operator}.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Your first name, phone number and class, which you give when you sign up.</li>
        <li>Your email address, only if you choose to give it (for payment receipts).</li>
        <li>Your answers to the check and the lessons, and your scores.</li>
        <li>The type of device you use (for example Android or iPhone), and technical logs that help us keep the site working.</li>
      </ul>
      <h2>Why we collect it</h2>
      <ul>
        <li>To give you your lessons and remember your progress.</li>
        <li>To let you sign back in with your phone number and recovery code.</li>
        <li>To confirm payments and handle refunds.</li>
        <li>To see which parts of the course help and which need fixing.</li>
      </ul>
      <h2>Who else processes it</h2>
      <ul>
        <li>Paystack, which processes payments. We never see your card details.</li>
        <li>Our hosting and database providers, which store the site and its data.</li>
        <li>Your browser&apos;s push service (for example Google or Apple), if you turn on reminders.</li>
      </ul>
      <p>We do not sell your data. We use no advertising or third-party tracking scripts.</p>
      <h2>Cookies</h2>
      <p>
        We use only essential first-party cookies: one to keep you signed in, one anonymous id that counts visits without identifying you, and one
        that remembers how you found us. No advertising cookies.
      </p>
      <h2>How long we keep it</h2>
      <p>
        We keep your account while you use it. Usage logs are deleted after 12 months. Payment records are kept as financial records even after you
        delete your account.
      </p>
      <h2>Students under 18</h2>
      <p>Many of our students are under 18. If you are under 18, a parent or guardian should agree to your using this site.</p>
      <h2>Deleting your data</h2>
      <p>
        Delete your data from your <Link href="/account">account page</Link>, or <a href={whatsappUrl}>message us on WhatsApp</a> and we will do it for
        you.
      </p>
      <h2>Questions</h2>
      <p>
        Privacy questions: <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>.
      </p>
    </LegalPage>
  );
}
