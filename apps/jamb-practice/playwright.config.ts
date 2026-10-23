import { defineConfig, devices } from '@playwright/test';

// Run `E2E=1 npm run build` first. The server uses the fake payment provider
// and fixtures, on its own throwaway database.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100/jamb-practice/',
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 740 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile-chromium' }],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://localhost:3100/jamb-practice/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
