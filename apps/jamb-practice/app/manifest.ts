import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.BASE_PATH ?? '/jamb-practice';
  return {
    name: process.env.PRODUCT_NAME ?? 'UTME English Booster',
    short_name: 'UTME English',
    description: 'Ten minutes of UTME English practice a day for 14 days.',
    id: `${base}/`,
    start_url: `${base}/?source=pwa`,
    scope: `${base}/`,
    display: 'standalone',
    background_color: '#f6f8fb',
    theme_color: '#1f4fd8',
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${base}/icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
