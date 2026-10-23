import 'server-only';
import path from 'node:path';
import { env } from './env';
import { isServable, loadContentSet, type ContentSet } from './contentStore';

const g = globalThis as unknown as { __jpContent?: { at: number; set: ContentSet } };

// Content changes only on deploy; a short cache keeps dev edits visible.
const TTL_MS = process.env.NODE_ENV === 'production' ? 5 * 60_000 : 2_000;

export function contentDir(): string {
  return path.resolve(process.cwd(), env().CONTENT_DIR);
}

export function getContent(): ContentSet {
  const now = Date.now();
  if (!g.__jpContent || now - g.__jpContent.at > TTL_MS) {
    g.__jpContent = { at: now, set: loadContentSet(contentDir()) };
  }
  return g.__jpContent.set;
}

export function allowUnreviewed(): boolean {
  return env().ALLOW_UNREVIEWED_CONTENT;
}

/** The lesson if it may be served, else null (shown as "unavailable"). */
export function servableLesson(day: number) {
  const item = getContent().lessons.get(day);
  return item && isServable(item, allowUnreviewed()) ? item.data! : null;
}

export function servableDiagnostic() {
  const item = getContent().diagnostic;
  return isServable(item, allowUnreviewed()) ? item.data! : null;
}

export function clearContentCache() {
  g.__jpContent = undefined;
}
