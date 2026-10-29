import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { getDb, setDbForTests } from '@/db';
import { resetEnvCache } from '@/lib/env';

describe('getDb with an on-disk PGlite database', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-db-'));
  const url = process.env.DATABASE_URL;

  afterEach(async () => {
    const open = (globalThis as { __jpPglite?: { client: { close(): Promise<void> } } }).__jpPglite;
    await open?.client.close();
    process.env.DATABASE_URL = url;
    resetEnvCache();
    setDbForTests(undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('tries again after finding the lock held by another live process', async () => {
    process.env.DATABASE_URL = `pglite:${path.join(dir, 'db')}`;
    resetEnvCache();
    setDbForTests(undefined);
    // The parent process is alive and is not this one, as a second app copy would be.
    fs.writeFileSync(path.join(dir, 'db.lock'), String(process.ppid));
    await expect(getDb()).rejects.toThrow(/already open/);

    // The other copy exits and its lock is gone: the next call connects.
    fs.rmSync(path.join(dir, 'db.lock'));
    const db = await getDb();
    expect(await db.execute(sql`select 1 as one`)).toBeTruthy();
  }, 60_000);
});
