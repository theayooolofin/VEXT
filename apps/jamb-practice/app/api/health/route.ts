import { sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let database = 'ok';
  try {
    const db = await getDb();
    await db.select({ one: sql<number>`1` }).from(schema.settings).limit(1);
  } catch {
    database = 'unreachable';
  }
  const version = process.env.APP_VERSION ?? process.env.npm_package_version ?? 'dev';
  return Response.json(
    { status: database === 'ok' ? 'ok' : 'degraded', version, database },
    { status: database === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
