import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TeachDeck } from '@/components/TeachDeck';
import { requireAdmin } from '@/lib/adminPage';
import { allowUnreviewed, getContent } from '@/lib/content';
import { isServable, toPublicLesson } from '@/lib/contentStore';
import './teach.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  return { title: `Teach Day ${n}` };
}

/** Teach mode for one day. Admin only: it shows every answer, paid days included. */
export default async function TeachDay({ params }: { params: Promise<{ n: string }> }) {
  await requireAdmin();
  const { n } = await params;
  const day = Number(n);
  if (!Number.isInteger(day) || day < 1 || day > 14) notFound();
  const content = getContent();
  const item = content.lessons.get(day);
  if (!item?.data) notFound();
  return (
    <TeachDeck
      lesson={toPublicLesson(item.data, content.topics)}
      notServed={!isServable(item, allowUnreviewed())}
    />
  );
}
