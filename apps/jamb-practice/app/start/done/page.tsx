import type { Metadata } from 'next';
import { RecoveryCodeOnce } from '@/components/RecoveryCode';
import { Page } from '@/components/Shell';
import { requirePageSession } from '@/lib/page';

export const metadata: Metadata = { title: 'Your recovery code' };

export default async function DonePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePageSession('/start/done');
  const sp = await searchParams;
  return (
    <Page>
      <h1>{sp.recovered ? `Welcome back, ${session.student.firstName}` : `You are in, ${session.student.firstName}`}</h1>
      <RecoveryCodeOnce recovered={Boolean(sp.recovered)} />
    </Page>
  );
}
