import 'server-only';
import path from 'node:path';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { env } from '@/lib/env';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const g = globalThis as unknown as { __jpDb?: Promise<Db> };

export const MIGRATIONS_DIR = path.join(process.cwd(), 'src/db/migrations');

async function connect(): Promise<Db> {
  const url = env().DATABASE_URL;
  if (url.startsWith('pglite:')) {
    // Local development and tests: Postgres compiled to WASM, no server needed.
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const dir = url.slice('pglite:'.length);
    if (dir !== 'memory') (await import('node:fs')).mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
    const client = dir === 'memory' ? new PGlite() : new PGlite(dir);
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    // The two drivers share the pg-core query builder; the cast keeps one Db type.
    const typed = db as unknown as Db;
    if (dir !== 'memory') {
      const { seed } = await import('./seedData');
      await seed(typed);
    }
    return typed;
  }
  const postgres = (await import('postgres')).default;
  const client = postgres(url, { max: 5, prepare: false });
  return drizzlePg(client, { schema });
}

export function getDb(): Promise<Db> {
  g.__jpDb ??= connect();
  return g.__jpDb;
}

/** Tests only: swap in a fresh database. */
export function setDbForTests(db: Promise<Db> | undefined) {
  g.__jpDb = db;
}

export { schema };
