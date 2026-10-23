'use client';

import { useState, type FormEvent } from 'react';
import { api, track } from '@/client/api';

export function BuyButton({ needsEmail, priceLabel }: { needsEmail: boolean; priceLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = needsEmail ? String(new FormData(e.currentTarget).get('email') ?? '').trim() : undefined;
    if (needsEmail && !/^\S+@\S+\.\S+$/.test(email ?? '')) {
      setError('Enter an email address for your payment receipt.');
      return;
    }
    setBusy(true);
    setError(null);
    const r = await api<{ paymentUrl: string }>('/api/checkout', { body: { sku: 'core-14', ...(email ? { email } : {}) } });
    if (r.ok) {
      location.assign(r.data.paymentUrl);
      return;
    }
    setBusy(false);
    setError(r.message);
    track('error_shown', { code: r.code });
  }

  return (
    <form onSubmit={pay} noValidate>
      {needsEmail && (
        <div className="field">
          <label htmlFor="email">Email for your receipt</label>
          <p className="hint" id="email-hint">
            The payment provider needs an email address. A parent&apos;s email is fine.
          </p>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" className="input" aria-describedby="email-hint" aria-invalid={Boolean(error)} />
        </div>
      )}
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-block" disabled={busy}>
        {busy ? 'Opening the payment page...' : `Pay ${priceLabel}`}
      </button>
    </form>
  );
}
