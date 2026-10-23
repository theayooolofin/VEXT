'use client';

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jamb-practice';

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; message: string; data?: Record<string, unknown> };

function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="jp-csrf"]')?.content ?? '';
}

export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        'x-csrf-token': csrfToken(),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    return { ok: false, status: 0, code: 'OFFLINE', message: 'You are offline. Check your connection and try again.' };
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (res.ok) return { ok: true, status: res.status, data: data as T };
  const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
  return {
    ok: false,
    status: res.status,
    code: err?.code ?? 'SERVER_ERROR',
    message: err?.message ?? 'Something went wrong on our side. Try again in a minute.',
    data: (data as Record<string, unknown>) ?? undefined,
  };
}

// ---------- First-party analytics, batched ----------

type QueuedEvent = { name: string; props?: Record<string, string | number | boolean | null>; path?: string };
const queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, 20) });
  const url = `${BASE}/api/events`;
  const sent = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, body);
  if (!sent) void fetch(url, { method: 'POST', body, keepalive: true, credentials: 'same-origin' }).catch(() => {});
  if (queue.length) flush();
}

export function track(name: string, props?: QueuedEvent['props']) {
  const path = location.pathname.slice(BASE.length) || '/';
  queue.push({ name, props, path });
  if (queue.length >= 10) flush();
  else timer ??= setTimeout(flush, 2000);
}

if (typeof window !== 'undefined') {
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  addEventListener('pagehide', flush);
}

export function newClientId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
