import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb, schema, type Db, type Tx } from '@/db';
import type { EntitlementLike } from './unlock';
import { isEntitlementActive } from './unlock';

export const CORE_SKU = 'core-14';

export type Access = {
  /** The live (unrevoked, unexpired) core entitlement, with its cohort start date. */
  active: (EntitlementLike & { id: string; cohortId: string | null; cohortName: string | null }) | null;
  hadExpired: boolean;
};

/** The student's core access. Reads only; never trusts anything from the client. */
export async function getAccess(studentId: string, now = new Date(), tx?: Tx | Db): Promise<Access> {
  const db = tx ?? (await getDb());
  const rows = await db
    .select({ e: schema.entitlements, c: schema.cohorts })
    .from(schema.entitlements)
    .leftJoin(schema.cohorts, eq(schema.cohorts.id, schema.entitlements.cohortId))
    .where(and(eq(schema.entitlements.studentId, studentId), eq(schema.entitlements.sku, CORE_SKU)))
    .orderBy(desc(schema.entitlements.grantedAt));
  let hadExpired = false;
  for (const { e, c } of rows) {
    const like: EntitlementLike = {
      revokedAt: e.revokedAt,
      expiresAt: e.expiresAt,
      cohortStartDate: c?.startDate ?? '1970-01-01',
    };
    if (isEntitlementActive(like, now)) {
      return { active: { ...like, id: e.id, cohortId: e.cohortId, cohortName: c?.name ?? null }, hadExpired: false };
    }
    if (!e.revokedAt) hadExpired = true;
  }
  return { active: null, hadExpired };
}

/** Unrevoked rows for (student, sku), including expired ones still holding the unique slot. */
export async function liveEntitlementRows(tx: Tx, studentId: string, sku: string) {
  return tx
    .select()
    .from(schema.entitlements)
    .where(
      and(
        eq(schema.entitlements.studentId, studentId),
        eq(schema.entitlements.sku, sku),
        isNull(schema.entitlements.revokedAt),
      ),
    );
}
