import type { AnchorHTMLAttributes } from 'react';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jamb-practice';

/**
 * A plain link inside the product. Used instead of next/link on student pages
 * so they ship no client-side routing code (spec 2: low data).
 */
export function A({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href.startsWith('/') ? `${BASE}${href}` : href} {...rest} />;
}
