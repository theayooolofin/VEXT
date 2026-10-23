import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { one, type SP } from '@/lib/adminPage';

export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };

export default async function AdminLogin({ searchParams }: { searchParams: SP }) {
  const msg = one((await searchParams).msg);
  return (
    <main id="main" className="admin">
      <div className="wrap">
        <h1>Admin sign in</h1>
        {msg && (
          <p className="alert" role="status">
            {msg}
          </p>
        )}
        <form method="post" action={`${env().BASE_PATH}/admin/actions/login`}>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
          </div>
          <button type="submit" className="btn">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
