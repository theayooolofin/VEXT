// npm run db:migrate | db:seed. Runs migrations against DATABASE_URL, then seeds.
import { getDb } from '@/db';
import { seed } from '@/db/seedData';

const cmd = process.argv[2];

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('pglite:')) {
    await getDb(); // PGlite migrates on connect
  } else {
    const postgres = (await import('postgres')).default;
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    const { MIGRATIONS_DIR } = await import('@/db');
    const client = postgres(url, { max: 1 });
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_DIR });
    await client.end();
  }
  console.log('Migrations applied.');
  if (cmd === 'seed') {
    await seed(await getDb());
    console.log('Seed data in place.');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
