import type { NextRequest } from 'next/server';
import { json } from '@/lib/http';
import { dashboard } from '@/lib/lessons';
import { requireStudent, rollSession } from '@/lib/request';
import { getSettings } from '@/lib/settingsRepo';

export async function GET(req: NextRequest) {
  const g = await requireStudent(req, { mutation: false });
  if (!g.ok) return g.res;
  const { student } = g.session;
  const settings = await getSettings();
  const { states, access } = await dashboard(student, settings);
  const res = json({
    student: { id: student.id, firstName: student.firstName, classLevel: student.classLevel, hasEmail: Boolean(student.email) },
    entitlement: access.active
      ? { active: true, cohort: { name: access.active.cohortName, startDate: access.active.cohortStartDate }, expiresAt: access.active.expiresAt }
      : { active: false, expired: access.hadExpired },
    days: states.map((s) => ({
      day: s.day,
      state: s.state,
      unlocksAt: s.state === 'locked' ? s.unlocksAt : undefined,
      score: s.state === 'done' ? s.score : undefined,
    })),
    serverTime: new Date(),
  });
  return rollSession(g.session, req, res);
}
