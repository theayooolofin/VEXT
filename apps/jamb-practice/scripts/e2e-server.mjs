// Starts the production build on port 3100 with a fresh local database and
// the fake payment provider, for the Playwright end-to-end tests only.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

fs.rmSync('.data/e2e', { recursive: true, force: true });

export const E2E_ENV = {
  E2E: '1',
  NODE_ENV: 'production',
  PORT: '3100',
  APP_BASE_URL: 'http://localhost:3100',
  BASE_PATH: '/jamb-practice',
  DATABASE_URL: 'pglite:.data/e2e',
  SESSION_SECRET: 'e2e-session-secret-that-is-long-enough-0001',
  IP_HASH_SALT: 'e2e-ip-salt-000001',
  PAYMENT_PROVIDER: 'fake',
  PAYMENT_PLACEHOLDER_EMAIL_DOMAIN: 'students.example.test',
  CRON_SECRET: 'e2e-cron-secret-000001',
  // base64url bcrypt of "e2e admin password"
  ADMIN_PASSWORD_HASH: 'JDJiJDA0JDRsandsRHFTTWVRTlZmdzhGVEJNR3VFajRCeENreHA3WTF2YTZTWVVrNWlDcWtVeEdhSjMy',
  SUPPORT_WHATSAPP_E164: '2348000000000',
  SUPPORT_EMAIL: 'support@example.test',
  PRODUCT_NAME: 'UTME English Booster',
  ALLOW_UNREVIEWED_CONTENT: process.env.E2E_ALLOW_UNREVIEWED ?? 'true',
  CONTENT_DIR: process.env.E2E_CONTENT_DIR ?? 'content/jamb-english/_fixtures',
};

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3100'], {
  stdio: 'inherit',
  env: { ...process.env, ...E2E_ENV },
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
