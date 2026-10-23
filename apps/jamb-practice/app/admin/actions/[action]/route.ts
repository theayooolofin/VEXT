import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { ADMIN_COOKIE, adminCookieOptions, adminCsrf, audit, checkAdminPassword, newAdminCookie, readAdminCookie } from '@/lib/admin';
import {
  adminDeleteStudent,
  adminNewRecoveryCode,
  grantAccess,
  markDuplicate,
  markRefunded,
  resolveReview,
  reverifyOrder,
  revokeAccess,
} from '@/lib/adminActions';
import { safeEqual } from '@/lib/crypto';
import { env } from '@/lib/env';
import { checkOrigin, clientIp } from '@/lib/http';
import { hashIp } from '@/lib/crypto';
import { hit, LIMITS } from '@/lib/rateLimit';
import { SETTING_KINDS, SETTING_LABELS, settingsSchema, type SettingKey } from '@/lib/settings';
import { saveSetting } from '@/lib/settingsRepo';
import { parseLagosLocal } from '@/lib/time';

type Result = { msg: string; back?: string } | Response;

function goBack(req: NextRequest, back: string, msg: string) {
  const safe = /^\/admin(\/[a-z0-9/_-]*)?(\?[^#]*)?$/i.test(back) ? back : '/admin';
  const url = new URL(`${env().BASE_PATH}${safe}`, env().APP_BASE_URL);
  if (msg) url.searchParams.set('msg', msg);
  return NextResponse.redirect(url, 303);
}

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? '').trim().slice(0, max);

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (!checkOrigin(req)) return new Response('Forbidden', { status: 403 });
  const ipHash = hashIp(clientIp(req));
  const form = await req.formData();
  const back = str(form, 'back', 200) || '/admin';

  if (action === 'login') {
    if (!(await hit(LIMITS.adminLogin, ipHash ?? 'unknown'))) return goBack(req, '/admin/login', 'Too many tries. Wait 15 minutes.');
    const ok = await checkAdminPassword(String(form.get('password') ?? ''));
    await audit(ok ? 'login' : 'login_failed', null, {}, ipHash);
    if (!ok) return goBack(req, '/admin/login', 'Wrong password.');
    const c = newAdminCookie();
    const res = goBack(req, '/admin', '');
    res.cookies.set(ADMIN_COOKIE, c.value, { ...adminCookieOptions(), expires: c.expires });
    return res;
  }

  const claims = readAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!claims) return goBack(req, '/admin/login', 'Sign in again.');
  if (!safeEqual(str(form, 'csrf', 100), adminCsrf(claims))) return new Response('Forbidden', { status: 403 });

  const result = await run(action, form, ipHash);
  if (result instanceof Response) return result;
  if (action === 'logout') {
    const res = goBack(req, '/admin/login', 'Signed out.');
    res.cookies.set(ADMIN_COOKIE, '', { ...adminCookieOptions(), maxAge: 0 });
    return res;
  }
  return goBack(req, result.back ?? back, result.msg);
}

async function run(action: string, f: FormData, ipHash: string | null): Promise<Result> {
  const db = await getDb();
  const log = (target: string | null, details: Record<string, unknown> = {}) => audit(action, target, details, ipHash);
  const id = str(f, 'id', 64);

  switch (action) {
    case 'logout':
      await log(null);
      return { msg: '' };

    case 'grant': {
      const r = await grantAccess(id, str(f, 'cohortId', 64), str(f, 'note', 300));
      if (r.ok) await log(id, { cohortId: str(f, 'cohortId'), note: str(f, 'note', 300) });
      return { msg: r.ok ? 'Access granted.' : r.message };
    }
    case 'revoke':
      await revokeAccess(id, str(f, 'note', 300));
      await log(id, { note: str(f, 'note', 300) });
      return { msg: 'Access revoked.' };

    case 'recovery-code': {
      const code = await adminNewRecoveryCode(id);
      await log(id);
      // Shown once, never put in a URL or a log.
      const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>New recovery code</title>
<body style="font-family:system-ui;padding:24px;max-width:32rem;margin:auto"><h1>New recovery code</h1>
<p>Send this to the student on WhatsApp. It is shown only once; the old code no longer works.</p>
<p style="font:800 1.6rem ui-monospace,monospace;letter-spacing:.08em;border:2px dashed #6b7c96;padding:16px;text-align:center">${code}</p>
<p><a href="${env().BASE_PATH}/admin/students/${encodeURIComponent(id)}">Back to the student</a></p></body>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    case 'delete-student':
      if (str(f, 'confirm') !== 'DELETE') return { msg: 'Type DELETE to confirm.' };
      await adminDeleteStudent(id);
      await log(id);
      return { msg: 'Student data deleted.', back: '/admin/students' };

    case 'reverify': {
      const r = await reverifyOrder(id);
      await log(id, { result: r.message });
      return { msg: r.message };
    }
    case 'refund': {
      const r = await markRefunded(id);
      if (r.ok) await log(id);
      return { msg: r.ok ? 'Marked refunded. Access revoked.' : r.message };
    }
    case 'resolve-review': {
      const r = await resolveReview(id);
      if (r.ok) await log(id, { message: r.message });
      return { msg: r.message };
    }
    case 'mark-duplicate':
      await markDuplicate(id);
      await log(id);
      return { msg: 'Marked duplicate. Refund it in the Paystack dashboard, then mark it refunded.' };

    case 'report-status': {
      const status = str(f, 'status') === 'fixed' ? 'fixed' : 'dismissed';
      await db
        .update(schema.questionReports)
        .set({ status, resolvedAt: new Date(), resolutionNote: str(f, 'note', 300) || null })
        .where(and(eq(schema.questionReports.questionId, str(f, 'questionId', 20)), eq(schema.questionReports.status, 'open')));
      await log(str(f, 'questionId', 20), { status, note: str(f, 'note', 300) });
      return { msg: `Reports marked ${status}.` };
    }
    case 'support-done':
      await db.update(schema.supportRequests).set({ status: 'done', handledAt: new Date() }).where(eq(schema.supportRequests.id, id));
      await log(id);
      return { msg: 'Marked done.' };

    case 'cohort-save': {
      const opens = parseLagosLocal(str(f, 'opens'));
      const closes = parseLagosLocal(str(f, 'closes'));
      const startDate = str(f, 'startDate');
      const name = str(f, 'name', 80);
      if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !opens || !closes || closes <= opens)
        return { msg: 'Check the name, start date and enrolment times (closing must be after opening).' };
      const values = { name, startDate, enrollmentOpensAt: opens, enrollmentClosesAt: closes, active: f.get('active') === 'on' };
      if (id) await db.update(schema.cohorts).set(values).where(eq(schema.cohorts.id, id));
      else await db.insert(schema.cohorts).values(values);
      await log(id || name, { ...values });
      return { msg: 'Cohort saved.' };
    }
    case 'spend-save': {
      const naira = Number(str(f, 'amount'));
      const date = str(f, 'date');
      const channel = str(f, 'channel', 60).toLowerCase().replace(/[^a-z0-9_\-.]/g, '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !channel || !Number.isFinite(naira) || naira < 0) return { msg: 'Check the date, channel and amount.' };
      const values = { date, channel, amountKobo: Math.round(naira * 100), note: str(f, 'note', 200) || null };
      if (id) await db.update(schema.adSpend).set(values).where(eq(schema.adSpend.id, id));
      else await db.insert(schema.adSpend).values(values);
      await log(id || null, values);
      return { msg: 'Spend saved.' };
    }
    case 'spend-delete':
      await db.delete(schema.adSpend).where(eq(schema.adSpend.id, id));
      await log(id);
      return { msg: 'Spend row deleted.' };

    case 'settings-save': {
      const errors: string[] = [];
      const changed: Record<string, unknown> = {};
      for (const key of Object.keys(SETTING_LABELS) as SettingKey[]) {
        const kind = SETTING_KINDS[key];
        const raw = f.get(key);
        if (raw === null && kind !== 'boolean') continue;
        let value: unknown;
        if (kind === 'boolean') value = raw === 'on';
        else if (kind === 'string') value = String(raw).trim();
        else if (kind === 'datetime') value = parseLagosLocal(String(raw))?.toISOString() ?? String(raw);
        else if (kind === 'naira') value = Math.round(Number(raw) * 100);
        else value = Number(raw);
        const p = settingsSchema.shape[key].safeParse(value);
        if (!p.success) errors.push(SETTING_LABELS[key]);
        else {
          await saveSetting(key, p.data);
          changed[key] = p.data;
        }
      }
      await log(null, { changed });
      return { msg: errors.length ? `Saved, except: ${errors.join('; ')}.` : 'Settings saved.' };
    }
    case 'nudge-mark': {
      const day = Number(str(f, 'day'));
      await db
        .insert(schema.reminderLog)
        .values({ studentId: id, day, kind: 'missed', channel: 'whatsapp_manual', result: 'sent' })
        .onConflictDoUpdate({
          target: [schema.reminderLog.studentId, schema.reminderLog.day, schema.reminderLog.kind, schema.reminderLog.channel],
          set: { sentAt: new Date() },
        });
      await log(id, { day });
      return { msg: 'Marked nudged.' };
    }
    default:
      return new Response('Unknown action', { status: 404 });
  }
}
