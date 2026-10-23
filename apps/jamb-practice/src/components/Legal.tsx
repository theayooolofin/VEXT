import type { ReactNode } from 'react';
import { Page } from './Shell';
import { Track } from './Track';

// LEGAL DRAFT: review before launch. Bump LAST_UPDATED when the wording changes.
export const LAST_UPDATED = '23 October 2026';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Page>
      <Track />
      <article>
        <h1>{title}</h1>
        <p className="small muted">Last updated: {LAST_UPDATED}</p>
        {children}
      </article>
    </Page>
  );
}
