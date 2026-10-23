import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, json, parseBody } from '@/lib/http';
import { requireStudent } from '@/lib/request';
import { clearSessionCookie } from '@/lib/session';
import { deleteStudent } from '@/lib/students';

const body = z.object({ confirm: z.string() });

export async function POST(req: NextRequest) {
  const g = await requireStudent(req, { mutation: true });
  if (!g.ok) return g.res;
  const p = await parseBody(req, body);
  if (!p.ok) return p.res;
  if (p.data.confirm.trim() !== 'DELETE')
    return apiError('VALIDATION_FAILED', 400, undefined, 'Type DELETE in capital letters to confirm.');
  await deleteStudent(g.session.student.id);
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
}
