// Test environment. No real secrets; the fake payment provider only.
Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_BASE_URL: 'https://vextglobal.test',
  BASE_PATH: '/jamb-practice',
  DATABASE_URL: 'pglite:memory',
  SESSION_SECRET: 'test-session-secret-that-is-long-enough-123456',
  IP_HASH_SALT: 'test-ip-salt-123456',
  PAYMENT_PROVIDER: 'fake',
  PAYMENT_PLACEHOLDER_EMAIL_DOMAIN: 'students.example.test',
  CRON_SECRET: 'test-cron-secret-123456',
  // base64url bcrypt of "correct horse battery staple"
  ADMIN_PASSWORD_HASH: 'JDJiJDA0JHJkMFpjV3dKUm92dnpUQzZ5blpyY3VWdHd6L3NFNGJyYWRGSGFYVFBUVURSYS4uVk56LkIu',
  SUPPORT_WHATSAPP_E164: '2348000000000',
  SUPPORT_EMAIL: 'support@example.test',
  PRODUCT_NAME: 'UTME English Booster',
  ALLOW_UNREVIEWED_CONTENT: 'true',
  CONTENT_DIR: 'content/jamb-english/_fixtures',
});
