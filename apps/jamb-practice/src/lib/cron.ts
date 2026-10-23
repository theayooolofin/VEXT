import 'server-only';
import { safeEqual } from './crypto';
import { env } from './env';

/** Cron endpoints require Authorization: Bearer <CRON_SECRET>. */
export function cronAuthorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token.length > 0 && safeEqual(token, env().CRON_SECRET);
}
