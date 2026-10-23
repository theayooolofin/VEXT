'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api } from '@/client/api';

export function RecoverForm({ whatsappUrl }: { whatsappUrl: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const r = await api<{ recoveryCode: string }>('/api/recover', {
      body: { phone: String(f.get('phone') ?? ''), code: String(f.get('code') ?? '') },
    });
    if (r.ok) {
      try {
        sessionStorage.setItem('jp_rc', r.data.recoveryCode);
      } catch {
        /* shown as missing on the next page */
      }
      router.push('/start/done?recovered=1');
      router.refresh();
      return;
    }
    setBusy(false);
    setError(r.message);
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && (
        <p className="alert alert-error" role="alert" id="recover-error">
          {error}
        </p>
      )}
      <div className="field">
        <label htmlFor="phone">Phone number</label>
        <input id="phone" name="phone" className="input" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="0803 123 4567" required aria-describedby={error ? 'recover-error' : undefined} />
      </div>
      <div className="field">
        <label htmlFor="code">Recovery code</label>
        <p className="hint" id="code-hint">
          12 letters and numbers, like K7QH-2WXM-9PTD.
        </p>
        <input id="code" name="code" className="input" autoCapitalize="characters" autoComplete="one-time-code" spellCheck={false} maxLength={20} required aria-describedby="code-hint" />
      </div>
      <button type="submit" className="btn btn-block" disabled={busy}>
        {busy ? 'Checking...' : 'Sign in'}
      </button>
      <p style={{ marginTop: 16 }}>
        Lost your code? <a href={whatsappUrl}>Message us on WhatsApp</a> and we will help you get back in.
      </p>
    </form>
  );
}
