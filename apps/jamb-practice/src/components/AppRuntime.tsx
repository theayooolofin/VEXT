'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { BASE } from '@/client/api';

function subscribeOnline(cb: () => void) {
  addEventListener('online', cb);
  addEventListener('offline', cb);
  return () => {
    removeEventListener('online', cb);
    removeEventListener('offline', cb);
  };
}

/** Registers the service worker, shows the offline banner and syncs queued answers. */
export function AppRuntime() {
  const offline = useSyncExternalStore(subscribeOnline, () => !navigator.onLine, () => false);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Only signed-in pages can have queued answers; others skip loading the queue code.
    const signedIn = Boolean(document.querySelector('meta[name="jp-csrf"]'));
    const flushQueue = () => (signedIn ? import('@/client/offlineQueue').then((m) => m.flushQueue()) : Promise.resolve(0));
    const on = () => void flushQueue();
    addEventListener('online', on);
    void flushQueue();

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register(`${BASE}/sw.js`, { scope: `${BASE}/` })
        .then((reg) => {
          const watch = (w: ServiceWorker | null) => {
            w?.addEventListener('statechange', () => {
              if (w.state === 'installed' && navigator.serviceWorker.controller) setUpdate(w);
            });
          };
          if (reg.waiting && navigator.serviceWorker.controller) setUpdate(reg.waiting);
          reg.addEventListener('updatefound', () => watch(reg.installing));
        })
        .catch(() => {});
    }
    return () => {
      removeEventListener('online', on);
    };
  }, []);

  return (
    <>
      {offline && (
        <div className="banner banner-offline" role="status">
          <div className="wrap">You are offline. Your answers are saved and will sync when you reconnect.</div>
        </div>
      )}
      {update && !offline && (
        <div className="banner" role="status">
          <div className="wrap">
            <span>A newer version is ready.</span>
            <button
              type="button"
              onClick={() => {
                update.postMessage('skipWaiting');
                navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </>
  );
}
