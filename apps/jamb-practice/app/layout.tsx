import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppRuntime } from '@/components/AppRuntime';
import { env } from '@/lib/env';
import { csrfForPage } from '@/lib/page';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const e = env();
  const base = new URL(`${e.BASE_PATH}/`, e.APP_BASE_URL);
  const description =
    'A free 5-minute check, then ten minutes of UTME English practice a day for 14 days. Days 1 to 3 free. Not affiliated with JAMB.';
  return {
    metadataBase: base,
    title: { default: `${e.PRODUCT_NAME}: 14 days of UTME English practice`, template: `%s | ${e.PRODUCT_NAME}` },
    description,
    applicationName: e.PRODUCT_NAME,
    openGraph: {
      type: 'website',
      siteName: e.PRODUCT_NAME,
      title: 'Practise UTME English for 14 days. Ten minutes a day.',
      description,
      url: base.toString(),
      images: [{ url: `${e.BASE_PATH}/og.png`, width: 1200, height: 630, alt: 'An exam answer sheet with a marked answer' }],
    },
    twitter: { card: 'summary_large_image', title: 'Practise UTME English for 14 days', description },
    icons: { icon: `${e.BASE_PATH}/icons/icon-192.png`, apple: `${e.BASE_PATH}/icons/apple-touch-icon.png` },
    appleWebApp: { capable: true, title: 'UTME English', statusBarStyle: 'default' },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1f4fd8',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const csrf = await csrfForPage();
  return (
    <html lang="en-NG">
      <head>{csrf && <meta name="jp-csrf" content={csrf} />}</head>
      <body>
        <AppRuntime />
        {children}
      </body>
    </html>
  );
}
