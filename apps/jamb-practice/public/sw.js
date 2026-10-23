/* Service worker for /jamb-practice/ only. Scope never reaches the rest of vextglobal.com. */
const VERSION = 'v1';
const SHELL = `jp-shell-${VERSION}`;
const STATIC = `jp-static-${VERSION}`;
const PRIVATE = `jp-private-${VERSION}`;
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');

const PRECACHE = [`${BASE}/offline`, `${BASE}/manifest.webmanifest`, `${BASE}/icons/icon-192.png`];

// Never cached: sign-in state, payments and anything that changes data.
const NEVER = [/\/api\/me$/, /\/api\/checkout/, /\/api\/orders\//, /\/api\/webhooks\//, /\/api\/cron\//, /\/api\/admin/, /\/buy(\/|$)/, /\/admin(\/|$)/, /\/dev\//];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('jp-') && !k.endsWith(`-${VERSION}`)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'clearPrivate') event.waitUntil(caches.delete(PRIVATE));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(`${BASE}/`) && url.pathname !== BASE) return;
  const path = url.pathname;
  if (NEVER.some((re) => re.test(path))) return;

  // Lesson JSON: network first, private copy for offline.
  if (/\/api\/lessons\/\d+$/.test(path)) {
    event.respondWith(networkFirst(req, PRIVATE, (res) => res.ok));
    return;
  }
  if (path.includes('/api/')) return;

  // Hashed build assets and icons: stale-while-revalidate.
  if (path.includes('/_next/static/') || path.includes('/icons/')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Pages: network first. Opened lessons and the dashboard are kept for offline.
  if (req.mode === 'navigate') {
    const keep = /\/learn(\/day\/\d+)?$/.test(path);
    event.respondWith(
      networkFirst(req, PRIVATE, (res) => keep && res.ok).catch(async () => (await caches.match(`${BASE}/offline`)) || Response.error()),
    );
  }
});

async function networkFirst(req, cacheName, shouldStore) {
  try {
    const res = await fetch(req);
    if (shouldStore(res)) {
      const cache = await caches.open(cacheName);
      await cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const hit = await caches.match(req, { cacheName });
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || network;
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Your lesson is ready', {
      body: data.body || '10 minutes today.',
      icon: `${BASE}/icons/icon-192.png`,
      badge: `${BASE}/icons/badge-96.png`,
      data: { url: data.url || `${BASE}/learn` },
      tag: 'jp-lesson',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url ? event.notification.data.url : `${BASE}/learn`;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(BASE) && 'focus' in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
