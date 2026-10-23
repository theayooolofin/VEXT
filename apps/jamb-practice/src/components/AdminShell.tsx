import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  ['/admin', 'Overview'],
  ['/admin/students', 'Students'],
  ['/admin/orders', 'Orders'],
  ['/admin/content', 'Content'],
  ['/admin/cohorts', 'Cohorts'],
  ['/admin/spend', 'Spend'],
  ['/admin/nudges', 'Nudges'],
  ['/admin/reports', 'Support'],
  ['/admin/settings', 'Settings'],
  ['/admin/audit', 'Audit log'],
] as const;

export function AdminShell({ current, title, msg, csrf, children }: { current: string; title: string; msg?: string; csrf: string; children: ReactNode }) {
  return (
    <div className="admin">
      <header className="site-header">
        <div className="wrap wrap-wide">
          <span className="brand">Admin</span>
          <ActionForm action="logout" csrf={csrf} back="/admin/login">
            <button type="submit" className="btn btn-quiet">
              Sign out
            </button>
          </ActionForm>
        </div>
        <div className="wrap wrap-wide">
          <nav className="admin-nav" aria-label="Admin">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} aria-current={current === href ? 'page' : undefined}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="main">
        <div className="wrap wrap-wide">
          <h1>{title}</h1>
          {msg && (
            <p className="alert" role="status">
              {msg}
            </p>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

/** A POST form to an admin action, carrying the admin CSRF token. */
export function ActionForm({
  action,
  csrf,
  fields,
  children,
  inline = true,
  back,
}: {
  action: string;
  csrf: string;
  fields?: Record<string, string>;
  children: ReactNode;
  inline?: boolean;
  back: string;
}) {
  const base = process.env.BASE_PATH ?? '/jamb-practice';
  return (
    <form method="post" action={`${base}/admin/actions/${action}`} className={inline ? 'inline-form' : undefined}>
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="back" value={back} />
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
    </form>
  );
}
