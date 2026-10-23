import { cronAuthorized } from '@/lib/cron';
import { runHousekeeping } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

async function handle(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: { code: 'FORBIDDEN', message: 'Not allowed.' } }, { status: 401 });
  return Response.json(await runHousekeeping());
}

export const POST = handle;
export const GET = handle;
