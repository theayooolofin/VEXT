import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { activeMock, mockAvailability, mockHistory } from '@/lib/mockRepo';
import { requireStudent, rollSession } from '@/lib/request';
import { getSettings } from '@/lib/settingsRepo';

/** The mock start page: whether one can start, a running one to resume, past scores. */
export async function GET(req: NextRequest) {
  const g = await requireStudent(req, { mutation: false });
  if (!g.ok) return g.res;
  const student = g.session.student;
  const now = new Date();
  const [availability, active, history] = await Promise.all([
    mockAvailability(student, await getSettings(), now),
    activeMock(student.id, now),
    mockHistory(student.id),
  ]);
  const res = json(
    { ...availability, active, history, serverTime: now },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
  return rollSession(g.session, req, res);
}
