'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/client/api';

const REASONS = [
  ['answer_seems_wrong', 'The answer seems wrong'],
  ['question_unclear', 'The question is unclear'],
  ['typo', 'There is a typo'],
  ['other', 'Something else'],
] as const;

/** Bottom sheet for "Report a problem" (spec 7.11). */
export function ReportSheet({ day, questionId, onClose }: { day: number; questionId: string; onClose: (sent: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    sheet.current?.querySelector<HTMLElement>('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current(false);
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const reason = f.get('reason');
    if (!reason) {
      setError('Choose what is wrong.');
      return;
    }
    setBusy(true);
    const r = await api('/api/questions/report', {
      body: { day, questionId, reason, message: String(f.get('message') ?? '').slice(0, 300) },
    });
    setBusy(false);
    if (r.ok) onClose(true);
    else setError(r.message);
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="report-title" ref={sheet}>
        <h2 id="report-title">What is wrong with this question?</h2>
        <form onSubmit={submit}>
          <fieldset className="radio-list" style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
            <legend className="sr-only">Reason</legend>
            {REASONS.map(([value, label]) => (
              <label key={value}>
                <input type="radio" name="reason" value={value} />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="report-message">Tell us more (optional)</label>
            <textarea id="report-message" name="message" className="input" maxLength={300} />
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="row">
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Sending...' : 'Send report'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => onClose(false)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
