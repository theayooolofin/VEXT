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

/** Validates the environment once and fails fast with a readable message. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
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
