import 'server-only';
import { getDb, schema } from '@/db';
import { env } from './env';
import { mergeSettings, type Settings } from './settings';

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select().from(schema.settings);
  return mergeSettings(rows);
}

export async function saveSetting(key: keyof Settings, value: unknown) {
  const db = await getDb();
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

/** Support contacts: settings override the environment defaults. */
export function supportContacts(s: Settings) {
  return {
    whatsapp: s.support_whatsapp || env().SUPPORT_WHATSAPP_E164,
    email: s.support_email || env().SUPPORT_EMAIL,
  };
}
