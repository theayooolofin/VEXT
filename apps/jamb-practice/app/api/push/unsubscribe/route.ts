import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { json, parseBody } from '@/lib/http';
import { requireStudent } from '@/lib/request';

const body = z.object({ endpoint: z.string().max(1000).optional() });

export async function POST(req: NextRequest) {
  const g = await requireStudent(req, { mutation: true });
  if (!g.ok) return g.res;
  const p = await parseBody(req, body);
  if (!p.ok) return p.res;
  const db = await getDb();
  const mine = eq(schema.pushSubscriptions.studentId, g.session.student.id);
  await db
    .update(schema.pushSubscriptions)
    .set({ revokedAt: new Date() })
    .where(p.data.endpoint ? and(mine, eq(schema.pushSubscriptions.endpoint, p.data.endpoint)) : mine);
  return json({ ok: true });
}
