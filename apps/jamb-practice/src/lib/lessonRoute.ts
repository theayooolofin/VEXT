import 'server-only';
import type { NextRequest } from 'next/server';
import { apiError } from './http';
import { decideLesson } from './lessons';
import { requireStudent } from './request';
import { getSettings } from './settingsRepo';

/** Shared guard for /api/lessons/[n]/*: signed in, valid day, lesson allowed. */
export async function loadLessonForRequest(req: NextRequest, nParam: string, mutation: boolean) {
  const g = await requireStudent(req, { mutation });
  if (!g.ok) return { ok: false as const, res: g.res };
  const day = Number(nParam);
  if (!Number.isInteger(day) || day < 1 || day > 14) return { ok: false as const, res: apiError('VALIDATION_FAILED', 404) };
  const settings = await getSettings();
  const decision = await decideLesson(g.session.student, day, settings);
  if (!decision.ok) {
    // 403 with a reason code, as in spec Appendix D.
    const extra = decision.unlocksAt ? { unlocksAt: decision.unlocksAt } : undefined;
    return { ok: false as const, res: apiError(decision.code, 403, extra, decision.message), decision };
  }
  return { ok: true as const, session: g.session, day, decision, settings };
}
