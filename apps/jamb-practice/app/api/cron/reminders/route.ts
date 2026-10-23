import { cronAuthorized } from '@/lib/cron';
import { runReminders } from '@/lib/jobs';
import { getSettings } from '@/lib/settingsRepo';

export const dynamic = 'force-dynamic';

async function handle(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: { code: 'FORBIDDEN', message: 'Not allowed.' } }, { status: 401 });
  const result = await runReminders(await getSettings());
  return Response.json(result);
}

// GET is accepted for schedulers that cannot POST; both need the bearer secret.
export const POST = handle;
export const GET = handle;
