import type { NextRequest } from 'next/server';
import { apiError, json } from '@/lib/http';
import { startMock } from '@/lib/mockRepo';
import { hit, LIMITS } from '@/lib/rateLimit';
import { requireStudent } from '@/lib/request';
import { getSettings } from '@/lib/settingsRepo';

/** Starts a timed mock (or returns the one running). The questions come without answers. */
export async function POST(req: NextRequest) {
  const g = await requireStudent(req, { mutation: true });
  if (!g.ok) return g.res;
  if (!(await hit(LIMITS.mock, g.session.student.id))) return apiError('RATE_LIMITED', 429);
  const now = new Date();
  const r = await startMock(g.session.student, await getSettings(), now);
  if (!r.ok) return apiError('MOCK_NOT_READY', 403);
  return json(
    { mock: r.mock, serverTime: now },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
