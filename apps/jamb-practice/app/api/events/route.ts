import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { CLIENT_EVENTS, EVENT_NAMES, type EventName } from '@/lib/events';
import { apiError, checkOrigin, json } from '@/lib/http';
import { hit, LIMITS } from '@/lib/rateLimit';
import { requestMeta } from '@/lib/request';
import { getSessionByToken, SESSION_COOKIE } from '@/lib/session';

const prop = z.union([z.string().max(100), z.number(), z.boolean(), z.null()]);
const body = z.object({
  events: z
    .array(
      z.object({
        name: z.enum(EVENT_NAMES),
        props: z.record(z.string().max(40), prop).optional().default({}),
        path: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return apiError('FORBIDDEN', 403);
  let parsed;
  try {
    // sendBeacon posts text/plain; accept any content type.
    parsed = body.safeParse(JSON.parse(await req.text()));
  } catch {
    return apiError('VALIDATION_FAILED', 400);
  }
  if (!parsed.success) return apiError('VALIDATION_FAILED', 400);
  const meta = requestMeta(req);
  if (!(await hit(LIMITS.events, meta.anonId ?? meta.ipHash))) return apiError('RATE_LIMITED', 429);
  const session = await getSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);

  const rows = parsed.data.events
    .filter((e) => CLIENT_EVENTS.has(e.name as EventName))
    .map((e) => ({
      name: e.name,
      props: Object.fromEntries(Object.entries(e.props).slice(0, 10)),
      path: e.path ?? null,
      anonId: meta.anonId,
      studentId: session?.student.id ?? null,
      utmSource: meta.attribution?.utm_source ?? null,
      utmMedium: meta.attribution?.utm_medium ?? null,
      utmCampaign: meta.attribution?.utm_campaign ?? null,
      userAgentClass: meta.userAgentClass,
    }));
  if (rows.length) {
    const db = await getDb();
    await db.insert(schema.events).values(rows);
  }
  return json({ accepted: rows.length }, { status: 202 });
}
