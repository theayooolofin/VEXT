import type { Metadata } from 'next';
import { MockPlayer } from '@/components/MockPlayer';
import { Page } from '@/components/Shell';
import { requirePageSession } from '@/lib/page';
import '../learn.css';

export const metadata: Metadata = { title: 'Timed mock' };

export default async function MockPage() {
  await requirePageSession('/learn/mock');
  // The questions are fetched by the player when the mock starts, never rendered here.
  return (
    <Page>
      <div className="player">
        <MockPlayer />
      </div>
    </Page>
  );
}
