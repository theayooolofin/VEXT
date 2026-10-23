import type { Metadata } from 'next';
import { A as Link } from '@/components/A';
import { RecoverForm } from '@/components/RecoverForm';
import { Page } from '@/components/Shell';
import { Track } from '@/components/Track';
import { siteInfo } from '@/lib/page';

export const metadata: Metadata = { title: 'Sign back in' };

export default async function RecoverPage() {
  const { whatsappUrl } = await siteInfo();
  return (
    <Page>
      <Track />
      <h1>Sign back in</h1>
      <p>Use the phone number you signed up with and your recovery code.</p>
      <RecoverForm whatsappUrl={whatsappUrl} />
      <p>
        New here? <Link href="/check">Take the free check</Link>.
      </p>
    </Page>
  );
}
