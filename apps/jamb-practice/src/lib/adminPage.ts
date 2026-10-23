import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, adminCsrf, readAdminCookie } from './admin';

/** Admin pages: redirect to login without a valid admin cookie. */
export async function requireAdmin() {
  const claims = readAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!claims) redirect('/admin/login');
  return { csrf: adminCsrf(claims) };
}

export function money(kobo: number | null | undefined): string {
  if (kobo == null) return '';
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

export function when(d: Date | null | undefined): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
