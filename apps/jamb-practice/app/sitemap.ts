import type { MetadataRoute } from 'next';

// Served at /jamb-practice/sitemap.xml. Add it to the main site's robots.txt
// (see docs/ARCHITECTURE.md). Only public pages are listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.APP_BASE_URL ?? 'https://vextglobal.com';
  const base = process.env.BASE_PATH ?? '/jamb-practice';
  return ['/', '/check', '/privacy', '/terms', '/refunds', '/contact'].map((p) => ({
    url: `${origin}${base}${p === '/' ? '/' : p}`,
    changeFrequency: 'weekly',
    priority: p === '/' ? 1 : 0.5,
  }));
}
