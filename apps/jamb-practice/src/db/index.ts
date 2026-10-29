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

type PGliteClient = InstanceType<typeof import('@electric-sql/pglite').PGlite>;
const gp = globalThis as unknown as { __jpPglite?: { client: PGliteClient; dir: string } };

/**
 * One process only may open an on-disk PGlite database. A lock file holding
 * the owner's pid stops a second copy of the app from corrupting the files;
 * a lock left by a crashed process is taken over.
 */
function takeLock(fs: typeof import('node:fs'), dir: string) {
  const lock = `${path.resolve(dir)}.lock`;
  try {
    const pid = Number(fs.readFileSync(lock, 'utf8'));
    if (pid && pid !== process.pid) {
      try {
        process.kill(pid, 0);
        throw new Error(`Database ${dir} is already open in process ${pid}. Run only one copy of the app.`);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ESRCH') throw e;
      }
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  fs.writeFileSync(lock, String(process.pid));
}

async function connect(): Promise<Db> {
  const url = env().DATABASE_URL;
  if (url.startsWith('pglite:')) {
    // Postgres compiled to WASM: tests, local development, and small single-server hosting.
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const dir = url.slice('pglite:'.length);
    if (dir !== 'memory') {
      const fs = await import('node:fs');
      fs.mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
      takeLock(fs, dir);
    }
    const client = dir === 'memory' ? new PGlite() : new PGlite(dir);
    if (dir !== 'memory') gp.__jpPglite = { client, dir };
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
  // A failed connection is not kept: on a host that briefly runs two copies,
  // the copy that finds the PGlite lock taken tries again on its next request.
  g.__jpDb ??= connect().catch((e: unknown) => {
    g.__jpDb = undefined;
    throw e;
  });
  return g.__jpDb;
}

/**
 * Daily compressed copy of an on-disk PGlite database, keeping the last 7.
 * Returns the file written, or null when there is nothing to back up.
 */
export async function backupPglite(now = new Date()): Promise<string | null> {
  const p = gp.__jpPglite;
  if (!p) return null;
  const fs = await import('node:fs');
  const dir = `${path.resolve(p.dir)}-backups`;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `db-${now.toISOString().slice(0, 10)}.tar.gz`);
  if (fs.existsSync(file)) return null;
  const blob = await p.client.dumpDataDir('gzip');
  fs.writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
  const old = fs.readdirSync(dir).filter((f) => f.startsWith('db-')).sort().slice(0, -7);
  for (const f of old) fs.rmSync(path.join(dir, f));
  return file;
}

/** Tests only: swap in a fresh database. */
export function setDbForTests(db: Promise<Db> | undefined) {
  g.__jpDb = db;
}

export { schema };
