import type { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { json } from '@/lib/http';
import { requireStudent } from '@/lib/request';
import { issueRecoveryCode } from '@/lib/session';

/** Issues a new recovery code (shown once) and invalidates the old one. */
export async function POST(req: NextRequest) {
  const g = await requireStudent(req, { mutation: true });
  if (!g.ok) return g.res;
  const db = await getDb();
  const code = await db.transaction((tx) => issueRecoveryCode(tx, g.session.student.id));
  return json({ recoveryCode: code });
}
