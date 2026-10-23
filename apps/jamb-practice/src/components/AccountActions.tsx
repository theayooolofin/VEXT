'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { api, BASE } from '@/client/api';
import { clearQueue } from '@/client/offlineQueue';
import { subscribePush } from './PushPrompt';
import { CodeCard } from './RecoveryCode';

async function clearPrivateData() {
  await clearQueue();
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('jp-private')).map((k) => caches.delete(k)));
  } catch {
    /* no Cache API */
  }
  navigator.serviceWorker?.controller?.postMessage('clearPrivate');
}

export function PushSettings({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<'unknown' | 'on' | 'off' | 'unsupported' | 'blocked'>('unknown');
  useEffect(() => {
    (async () => {
      if (!vapidPublicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) return setState('unsupported');
      if (Notification.permission === 'denied') return setState('blocked');
      const reg = await navigator.serviceWorker.getRegistration(`${BASE}/`);
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, [vapidPublicKey]);

  if (state === 'unknown') return null;
  if (state === 'unsupported')
    return <p className="muted">Reminders are not available in this browser. On iPhone, add this site to your Home Screen first, then open it from there.</p>;
  if (state === 'blocked') return <p className="muted">Notifications are blocked for this site in your browser settings.</p>;
  return (
    <div className="row">
      <span>Reminders are {state === 'on' ? 'on' : 'off'}.</span>
      {state === 'on' ? (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            const reg = await navigator.serviceWorker.getRegistration(`${BASE}/`);
            const sub = await reg?.pushManager.getSubscription();
            await api('/api/push/unsubscribe', { body: { endpoint: sub?.endpoint } });
            await sub?.unsubscribe();
            setState('off');
          }}
        >
          Turn off
        </button>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={async () => setState((await subscribePush(vapidPublicKey!)) === 'granted' ? 'on' : 'off')}>
          Turn on
        </button>
      )}
    </div>
  );
}

export function NewRecoveryCode() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  if (code) return <CodeCard code={code} copied={copied} onCopy={() => setCopied(true)} />;
  return confirming ? (
    <div className="stack">
      <p>Your old code will stop working. Continue?</p>
      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={async () => {
            const r = await api<{ recoveryCode: string }>('/api/account/recovery-code', { body: {} });
            if (r.ok) setCode(r.data.recoveryCode);
          }}
        >
          Make a new code
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
      Make a new recovery code
    </button>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={async () => {
        await api('/api/logout', { body: {} });
        await clearPrivateData();
        router.push('/');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function DeleteAccount() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const confirm = String(new FormData(e.currentTarget).get('confirm') ?? '');
    if (confirm.trim() !== 'DELETE') {
      setError('Type DELETE in capital letters to confirm.');
      return;
    }
    setBusy(true);
    const r = await api('/api/account/delete', { body: { confirm } });
    if (r.ok) {
      await clearPrivateData();
      router.push('/?deleted=1');
      router.refresh();
      return;
    }
    setBusy(false);
    setError(r.message);
  }
  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="confirm">Type DELETE to remove your account and details.</label>
        <input id="confirm" name="confirm" className="input" autoComplete="off" autoCapitalize="characters" aria-invalid={Boolean(error)} aria-describedby={error ? 'delete-error' : undefined} />
        {error && (
          <p id="delete-error" className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-danger" disabled={busy}>
        {busy ? 'Deleting...' : 'Delete my data'}
      </button>
    </form>
  );
}
