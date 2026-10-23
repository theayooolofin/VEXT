import { A as Link } from '@/components/A';
import type { ReactNode } from 'react';
import { siteInfo, pageSession } from '@/lib/page';

export async function Header() {
  const [{ productName }, session] = await Promise.all([siteInfo(), pageSession()]);
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand">
          {productName}
        </Link>
        {session ? (
          <nav aria-label="Account" className="header-nav">
            <Link href="/learn" className="header-link">
              My 14 days
            </Link>
            <Link href="/account" className="header-link">
              Account
            </Link>
          </nav>
        ) : (
          <Link href="/recover" className="header-link">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

export async function Footer() {
  const { whatsappUrl, support } = await siteInfo();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <nav aria-label="Legal and support">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refunds">Refunds</Link>
          <Link href="/contact">Contact</Link>
          <a href={whatsappUrl} rel="noopener">
            WhatsApp support
          </a>
        </nav>
        <p>This site is not affiliated with JAMB.</p>
        <p className="small">
          Questions: <a href={`mailto:${support.email}`}>{support.email}</a>
        </p>
      </div>
    </footer>
  );
}

export async function Page({ children, narrow = true }: { children: ReactNode; narrow?: boolean }) {
  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <div className={narrow ? 'wrap' : 'wrap wrap-wide'}>{children}</div>
      </main>
      <Footer />
    </>
  );
}
