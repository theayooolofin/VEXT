import type { Metadata } from 'next';
import { A as Link } from '@/components/A';
import { redirect } from 'next/navigation';
import { Page } from '@/components/Shell';
import { SignupForm } from '@/components/SignupForm';
import { Track } from '@/components/Track';
import { pageSession, siteInfo } from '@/lib/page';
import { CONSENT_TEXT } from '@/lib/students';

export const metadata: Metadata = { title: 'Start Day 1 free' };

function safeNext(v: string | string[] | undefined): string {
  const s = typeof v === 'string' ? v : '';
  return /^\/[a-z0-9/_-]*$/i.test(s) && !s.startsWith('//') ? s : '/learn/day/1';
}

export default async function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await pageSession()) redirect(next);
  const { whatsappUrl } = await siteInfo();
  return (
    <Page>
      <Track />
      <h1>Start Day 1 free</h1>
      <p>No password. We give you a recovery code to sign back in on another phone.</p>
      <SignupForm consentText={CONSENT_TEXT} whatsappUrl={whatsappUrl} next={next} />
      <p style={{ marginTop: 20 }}>
        Already signed up? <Link href="/recover">Sign back in</Link>.
      </p>
    </Page>
  );
}
