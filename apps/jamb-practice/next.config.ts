import type { NextConfig } from 'next';

const basePath = process.env.BASE_PATH ?? '/jamb-practice';

const nextConfig: NextConfig = {
  basePath,
  poweredByHeader: false,
  reactStrictMode: true,
  // The PWA start_url and scope are "/jamb-practice/" (spec 9.9), so the
  // trailing-slash form must be served, not redirected out of scope.
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ['@electric-sql/pglite', 'web-push'],
  // Lesson files are read from disk at runtime by the server only. They must
  // ship with the server build, never in public/ or the client bundle.
  outputFileTracingIncludes: {
    '/**': ['./content/jamb-english/**/*.json', './src/db/migrations/**/*'],
  },
  outputFileTracingExcludes: {
    '/**': ['./content/jamb-english/_fixtures/**'],
  },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: `${basePath}/` },
        ],
      },
    ];
  },
};

export default nextConfig;
