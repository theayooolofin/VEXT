'use client';

import { A as Link } from '@/components/A';
import { useEffect, useState } from 'react';
import { api, track } from '@/client/api';

type Status = { status: string; firstLessonAt: string | null; accessMissing: boolean };

const PENDING = 'We are confirming your payment. This usually takes under a minute. Please do not pay again.';

/** Polls every 2 seconds for up to 60 seconds; the server verifies with the provider. */
export function ReturnPoller({ reference, whatsappUrl, startLabel }: { reference: string; whatsappUrl: string; startLabel: string | null }) {
  const [state, setState] = useState<'checking' | 'paid' | 'failed' | 'pending' | 'review' | 'missing' | 'unknown'>('checking');

  useEffect(() => {
    let stop = false;
    const started = Date.now();
    async function poll() {
      if (stop) return;
      const r = await api<Status>(`/api/orders/${encodeURIComponent(reference)}/status`);
      if (stop) return;
      if (r.ok) {
        const s = r.data.status;
        if (s === 'paid' || s === 'duplicate') {
          setState(r.data.accessMissing ? 'missing' : 'paid');
          return;
        }
        if (s === 'failed') {
          setState('failed');
          track('error_shown', { code: 'PAYMENT_FAILED' });
          return;
        }
        if (s === 'needs_review') {
          setState('review');
          return;
        }
      } else if (r.status === 404) {
        setState('unknown');
        return;
      }
      if (Date.now() - started > 60_000) {
        setState('pending');
        return;
      }
      setTimeout(poll, 2000);
    }
    void poll();
    return () => {
      stop = true;
    };
  }, [reference]);

  return (
    <div aria-live="polite">
      {state === 'checking' && <p className="alert">{PENDING}</p>}
      {state === 'paid' && (
        <>
          <p className="alert alert-ok">Your payment is confirmed. Opening your lessons...</p>
          {startLabel && <p>{startLabel}</p>}
          <Link href="/learn" className="btn btn-block">
            Open my 14 days
          </Link>
        </>
      )}
      {state === 'failed' && (
        <>
          <p className="alert alert-error">Your payment did not go through. You have not been charged. Try again or use another payment method.</p>
          <Link href="/buy" className="btn btn-block">
            Try again
          </Link>
        </>
      )}
      {state === 'pending' && (
        <>
          <p className="alert">{PENDING}</p>
          <p>
            Bank transfers can take a few minutes. Keep this page open or come back later; your lessons unlock as soon as the payment is confirmed. If
            your account was debited and nothing changes within an hour, <a href={whatsappUrl}>message us on WhatsApp</a> with reference{' '}
            <strong>{reference}</strong>.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => location.reload()}>
            Check again
          </button>
        </>
      )}
      {(state === 'review' || state === 'missing') && (
        <p className="alert">
          Your payment is confirmed and we are checking one detail before opening Days 4 to 14. <a href={whatsappUrl}>Message us on WhatsApp</a> with
          reference <strong>{reference}</strong> and we will sort it out quickly.
        </p>
      )}
      {state === 'unknown' && (
        <p className="alert alert-error">
          We could not find that payment. If you paid, <a href={whatsappUrl}>message us on WhatsApp</a> with the reference from your receipt.
        </p>
      )}
    </div>
  );
}
