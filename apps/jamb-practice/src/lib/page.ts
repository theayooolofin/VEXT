import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ANON_COOKIE, isValidAnonId } from './attribution';
import { env } from './env';
import { csrfTokenFor } from './http';
import { getSessionByToken, SESSION_COOKIE } from './session';
import { getSettings, supportContacts } from './settingsRepo';
import { whatsappLink } from './rules';

/** Session for server components. Never sets cookies (pages cannot). */
export async function pageSession() {
  const jar = await cookies();
  return getSessionByToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requirePageSession(next: string) {
  const s = await pageSession();
  if (!s) redirect(`/start?next=${encodeURIComponent(next)}`);
  return s;
}

export async function pageAnonId() {
  const v = (await cookies()).get(ANON_COOKIE)?.value;
  return isValidAnonId(v) ? v : null;
}

export async function csrfForPage(): Promise<string | null> {
  const s = await pageSession();
  return s ? csrfTokenFor(s.tokenHash) : null;
}

export async function siteInfo() {
  const settings = await getSettings();
  const support = supportContacts(settings);
  return {
    productName: env().PRODUCT_NAME,
    support,
    whatsappUrl: whatsappLink(support.whatsapp),
    settings,
  };
}
