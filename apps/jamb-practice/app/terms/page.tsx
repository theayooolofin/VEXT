// LEGAL DRAFT: review before launch.
import type { Metadata } from 'next';
import { A as Link } from '@/components/A';
import { LegalPage } from '@/components/Legal';
import { env } from '@/lib/env';
import { siteInfo } from '@/lib/page';

export const metadata: Metadata = { title: 'Terms' };

export default async function TermsPage() {
  const { productName, settings } = await siteInfo();
  const operator = env().LEGAL_BUSINESS_NAME || `the operator of ${productName}`;
  return (
    <LegalPage title="Terms">
      <h2>What this service is</h2>
      <p>
        {productName} is a 14-day English practice course for students preparing for the UTME, run by {operator}. Each day has a short rule and 10
        practice questions with explanations.
      </p>
      <h2>Not affiliated with JAMB</h2>
      <p>This site is not affiliated with JAMB or any examination body.</p>
      <h2>No guarantee of results</h2>
      <p>We cannot promise any exam result or score. The course gives you focused practice and clear explanations.</p>
      <h2>Access</h2>
      <p>
        Days 1 to 3 are free. The paid pack opens Days 4 to 14 for your group and lasts 90 days from the group&apos;s start date. Payment is once; nothing
        renews.
      </p>
      <h2>Refunds</h2>
      <p>
        You can ask for a refund within {settings.refund_window_hours} hours after your first paid lesson opens. See <Link href="/refunds">refunds</Link>.
      </p>
      <h2>Fair use</h2>
      <p>The lessons are for your personal use. Please do not copy, share or sell the paid content.</p>
      <h2>Changes</h2>
      <p>We may improve or correct lessons and these terms. We will show the date of the last change on this page.</p>
    </LegalPage>
  );
}
