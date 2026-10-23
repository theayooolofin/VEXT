import { NextResponse, type NextRequest } from 'next/server';
import {
  ANON_COOKIE,
  ANON_MAX_AGE,
  ATTR_COOKIE,
  ATTR_MAX_AGE,
  attributionFromParams,
  encodeAttribution,
  isValidAnonId,
} from '@/lib/attribution';
import { randomToken } from '@/lib/crypto';

// Runs before every page: sets the anonymous id and first-touch attribution
// cookies, and a strict nonce-based Content Security Policy.
export function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // React sets style attributes for small layout values; scripts stay strict.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // The pay button posts to our server, which redirects to the provider.
    "form-action 'self' https://checkout.paystack.com",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const basePath = req.nextUrl.basePath || '/jamb-practice';
  const cookie = { path: basePath, secure: true, sameSite: 'lax' as const };

  if (!isValidAnonId(req.cookies.get(ANON_COOKIE)?.value)) {
    res.cookies.set(ANON_COOKIE, randomToken(18), { ...cookie, maxAge: ANON_MAX_AGE });
  }
  // First touch wins: only write attribution when none is stored yet.
  if (!req.cookies.get(ATTR_COOKIE)) {
    const attr = attributionFromParams(req.nextUrl.searchParams);
    if (attr) res.cookies.set(ATTR_COOKIE, encodeAttribution(attr), { ...cookie, maxAge: ATTR_MAX_AGE });
  }
  return res;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|sw.js|manifest.webmanifest|icons|og.png|favicon.ico|robots.txt|sitemap.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
