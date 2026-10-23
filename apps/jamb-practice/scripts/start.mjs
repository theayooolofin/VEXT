// Production start: apply database migrations and the minimal seed rows, then
// start Next.js. Uses runtime dependencies only, so hosts that install without
// devDependencies (for example Hostinger's Node.js hosting) can run it.
import { spawn } from 'node:child_process';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL ?? '';
if (url.startsWith('postgres')) {
  const sql = postgres(url, { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder: path.join(process.cwd(), 'src/db/migrations') });
  // Same rows as src/db/seedData.ts; settings fall back to defaults in code.
  await sql`insert into products (sku, name, price_kobo, kind, access_days)
            values ('core-14', '14-day UTME English pack', 30000, 'core', 90)
            on conflict (sku) do nothing`;
  await sql`insert into cohorts (name, start_date, enrollment_opens_at, enrollment_closes_at, active)
            select 'Founding cohort', '2026-11-16', '2026-11-01T23:00:00Z', '2026-11-15T22:59:00Z', true
            where not exists (select 1 from cohorts where name = 'Founding cohort')`;
  await sql.end();
  console.log(JSON.stringify({ level: 'info', msg: 'migrations applied' }));
}

const port = process.env.PORT ?? '3000';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', port], { stdio: 'inherit' });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
