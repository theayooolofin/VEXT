import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/server-only-stub.ts'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // PGlite instances are per file; keep files in separate workers.
    pool: 'forks',
  },
});
