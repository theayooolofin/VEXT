import { eq } from 'drizzle-orm';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { lagosDateTime } from '@/lib/time';
import * as schema from './schema';
import type { Db } from './index';

/** Idempotent: safe to run on every deploy. Never overwrites owner edits. */
export async function seed(db: Db) {
  await db
    .insert(schema.products)
    .values({ sku: 'core-14', name: '14-day UTME English pack', priceKobo: 30000, kind: 'core', accessDays: 90 })
    .onConflictDoNothing();

  const existing = await db.query.cohorts.findFirst({ where: eq(schema.cohorts.name, 'Founding cohort') });
  if (!existing) {
    await db.insert(schema.cohorts).values({
      name: 'Founding cohort',
      startDate: '2026-11-16',
      enrollmentOpensAt: lagosDateTime('2026-11-02', '00:00'),
      enrollmentClosesAt: lagosDateTime('2026-11-15', '23:59'),
      active: true,
    });
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(schema.settings).values({ key, value }).onConflictDoNothing();
  }
}
