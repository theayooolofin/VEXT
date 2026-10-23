'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/client/api';

export function SupportForm({ type, signedIn, whatsappUrl, label }: { type: 'refund' | 'question'; signedIn: boolean; whatsappUrl: string; label: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const r = await api('/api/support', {
      body: { type, message: String(f.get('message') ?? ''), phone: signedIn ? undefined : String(f.get('phone') ?? '') },
    });
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.message);
  }

  if (sent)
    return (
      <p className="alert alert-ok" role="status">
        Thank you. We have your request. To speed things up, <a href={whatsappUrl}>message us on WhatsApp</a> too.
      </p>
    );
  return (
    <form onSubmit={submit} noValidate>
      {!signedIn && (
        <div className="field">
          <label htmlFor="support-phone">Phone number you signed up with</label>
          <input id="support-phone" name="phone" type="tel" inputMode="tel" className="input" autoComplete="tel-national" />
        </div>
      )}
      <div className="field">
        <label htmlFor="support-message">{label}</label>
        <textarea id="support-message" name="message" className="input" maxLength={500} />
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn" disabled={busy}>
        {busy ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
