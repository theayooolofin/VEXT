'use client';

import { useEffect, useState } from 'react';
import { api, BASE, track } from '@/client/api';

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function subscribePush(vapidPublicKey: string): Promise<'granted' | 'denied' | 'error'> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` });
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
    const json = sub.toJSON();
    const r = await api('/api/push/subscribe', { body: { endpoint: json.endpoint, keys: json.keys } });
    return r.ok ? 'granted' : 'error';
  } catch {
    return 'error';
  }
}

/**
 * Shown only after a finished lesson, never on first visit. On iPhone outside
 * an installed web app, push cannot work, so a one-time how-to banner shows instead.
 */
export function PushPrompt({ vapidPublicKey, whatsappUrl }: { vapidPublicKey: string | null; whatsappUrl: string }) {
  const [mode, setMode] = useState<'none' | 'prompt' | 'ios' | 'done' | 'denied'>('none');

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem('jp_push_prompted') === '1';
    } catch {
      /* private mode: show it */
    }
    if (seen || !vapidPublicKey) return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    // Browser-only state, read once after mount (the server cannot know it).
    if (isIos() && !isStandalone()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('ios');
      track('ios_banner_shown');
    } else if (supported && Notification.permission === 'default') {
      setMode('prompt');
      track('push_prompt_shown');
    }
  }, [vapidPublicKey]);

  const remember = () => {
    try {
      localStorage.setItem('jp_push_prompted', '1');
    } catch {
      /* ignore */
    }
  };

  if (mode === 'none') return null;
  if (mode === 'ios')
    return (
      <div className="card" role="region" aria-label="Reminders on iPhone" style={{ marginTop: 20 }}>
        <p>To get reminders on iPhone, tap Share, then Add to Home Screen, then open the app from your Home Screen.</p>
        <p className="small muted">
          Or <a href={whatsappUrl}>message us on WhatsApp</a> and we can remind you there.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            remember();
            setMode('none');
          }}
        >
          Got it
        </button>
      </div>
    );
  if (mode === 'done')
    return (
      <p className="alert alert-ok" role="status" style={{ marginTop: 20 }}>
        Reminders are on. We send at most one a day, never at night.
      </p>
    );
  if (mode === 'denied')
    return (
      <p className="alert" role="status" style={{ marginTop: 20 }}>
        No reminders. You can turn them on later from your account page.
      </p>
    );
  return (
    <div className="card" role="region" aria-label="Reminders" style={{ marginTop: 20 }}>
      <p>
        <strong>Get a reminder when each day opens?</strong>
      </p>
      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={async () => {
            remember();
            const r = await subscribePush(vapidPublicKey!);
            track(r === 'granted' ? 'push_granted' : 'push_denied');
            setMode(r === 'granted' ? 'done' : 'denied');
          }}
        >
          Yes, remind me
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            remember();
            track('push_denied');
            setMode('none');
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
