import fs from 'node:fs';
import path from 'node:path';
import { createECDH, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_BASE_URL: z.url(),
    BASE_PATH: z
      .string()
      .regex(/^\/[a-z0-9-]+$/)
      .default('/jamb-practice'),
    DATABASE_URL: z
      .string()
      .min(1)
      .refine((v) => /^(postgres(ql)?:\/\/|pglite:)/.test(v), 'Use postgres://... or pglite:<dir>'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET needs at least 32 characters'),
    IP_HASH_SALT: z.string().min(16),
    // Server-only folder (outside the web root) for generated secrets on a single server.
    DATA_DIR: z.string().optional(),
    // Run reminders and housekeeping inside the app instead of an external cron.
    IN_PROCESS_CRON: bool,
    PAYMENT_PROVIDER: z.enum(['paystack', 'fake']).default('paystack'),
    PAYSTACK_SECRET_KEY: z.string().optional(),
    PAYSTACK_PUBLIC_KEY: z.string().optional(),
    // When set, students without an email pay with <id>@<domain>. When empty,
    // checkout asks for an email (BUILD_SPEC Phase 0 question 11).
    PAYMENT_PLACEHOLDER_EMAIL_DOMAIN: z.string().optional(),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
    CRON_SECRET: z.string().min(16),
    ADMIN_PASSWORD_HASH: z.string().min(20),
    SUPPORT_WHATSAPP_E164: z.string().regex(/^\d{8,15}$/, 'Digits only, with country code'),
    SUPPORT_EMAIL: z.email(),
    PRODUCT_NAME: z.string().min(2).default('UTME English Booster'),
    // Shown on the legal pages. Leave empty until the owner confirms them.
    LEGAL_BUSINESS_NAME: z.string().optional(),
    PRIVACY_CONTACT_EMAIL: z.string().optional(),
    ALLOW_UNREVIEWED_CONTENT: bool,
    CONTENT_DIR: z.string().default('content/jamb-english'),
  })
  .superRefine((env, ctx) => {
    // E2E=1 marks a local production build used only by the end-to-end tests.
    if (env.NODE_ENV !== 'production' || process.env.E2E === '1') return;
    if (env.ALLOW_UNREVIEWED_CONTENT)
      ctx.addIssue({ code: 'custom', path: ['ALLOW_UNREVIEWED_CONTENT'], message: 'Must be false in production' });
    if (env.PAYMENT_PROVIDER === 'fake')
      ctx.addIssue({ code: 'custom', path: ['PAYMENT_PROVIDER'], message: 'The fake provider is for tests only' });
    if (env.CONTENT_DIR.includes('_fixtures'))
      ctx.addIssue({ code: 'custom', path: ['CONTENT_DIR'], message: 'Fixtures never ship to production' });
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

const GENERATED = ['SESSION_SECRET', 'IP_HASH_SALT', 'CRON_SECRET', 'ADMIN_PASSWORD_HASH'] as const;

/**
 * On a single server, secrets missing from the environment are generated
 * once and kept in DATA_DIR/secrets.json (outside the web root, owner-only).
 * A new admin password is written once to DATA_DIR/ADMIN-PASSWORD.txt for the
 * owner to read and then delete. Values in the environment always win.
 */
function withGeneratedSecrets(raw: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const dir = raw.DATA_DIR;
  const missing = GENERATED.some((k) => !raw[k]) || !raw.VAPID_PRIVATE_KEY;
  if (!dir || !missing) return raw;
  const file = path.resolve(dir, 'secrets.json');
  let store: Record<string, string> = {};
  try {
    store = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    store = {};
  }
  let changed = false;
  const put = (k: string, make: () => string) => {
    if (!store[k]) {
      store[k] = make();
      changed = true;
    }
  };
  put('SESSION_SECRET', () => randomBytes(48).toString('base64url'));
  put('IP_HASH_SALT', () => randomBytes(24).toString('base64url'));
  put('CRON_SECRET', () => randomBytes(32).toString('base64url'));
  if (!store.ADMIN_PASSWORD_HASH) {
    const password = randomBytes(15).toString('base64url');
    store.ADMIN_PASSWORD_HASH = bcrypt.hashSync(password, 12);
    fs.mkdirSync(path.resolve(dir), { recursive: true });
    fs.writeFileSync(
      path.resolve(dir, 'ADMIN-PASSWORD.txt'),
      `Admin password for /jamb-practice/admin:
${password}

Save it in a password manager, then delete this file.
`,
      { mode: 0o600 },
    );
    changed = true;
  }
  if (!store.VAPID_PRIVATE_KEY) {
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    const priv = Buffer.alloc(32);
    const raw32 = ecdh.getPrivateKey();
    raw32.copy(priv, 32 - raw32.length);
    store.VAPID_PUBLIC_KEY = ecdh.getPublicKey().toString('base64url');
    store.VAPID_PRIVATE_KEY = priv.toString('base64url');
    changed = true;
  }
  if (changed) {
    fs.mkdirSync(path.resolve(dir), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(store, null, 2), { mode: 0o600 });
  }
  const out = { ...raw };
  for (const k of GENERATED) out[k] ||= store[k];
  if (!out.VAPID_SUBJECT && out.SUPPORT_EMAIL) out.VAPID_SUBJECT = `mailto:${out.SUPPORT_EMAIL}`;
  if (!out.VAPID_PRIVATE_KEY) {
    out.VAPID_PRIVATE_KEY = store.VAPID_PRIVATE_KEY;
    out.VAPID_PUBLIC_KEY = store.VAPID_PUBLIC_KEY;
  }
  return out;
}

/** Validates the environment once and fails fast with a readable message. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(withGeneratedSecrets(process.env));
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment for jamb-practice:\n${lines.join('\n')}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests that change process.env between cases. */
export function resetEnvCache() {
  cached = undefined;
}
