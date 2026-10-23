import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { json, parseBody } from '@/lib/http';
import { requireStudent, requestMeta } from '@/lib/request';

const body = z.object({
  endpoint: z.url().max(1000).refine((u) => u.startsWith('https://'), 'https only'),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export async function POST(req: NextRequest) {
  const g = await requireStudent(req, { mutation: true });
  if (!g.ok) return g.res;
  const p = await parseBody(req, body);
  if (!p.ok) return p.res;
  const db = await getDb();
  const values = {
    studentId: g.session.student.id,
    endpoint: p.data.endpoint,
    p256dh: p.data.keys.p256dh,
    auth: p.data.keys.auth,
    userAgentClass: requestMeta(req).userAgentClass,
    failedCount: 0,
    revokedAt: null,
  };
  await db
    .insert(schema.pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { ...values, updatedAt: new Date() } });
  return json({ ok: true }, { status: 201 });
}
