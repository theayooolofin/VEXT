'use client';

import { A as Link } from '@/components/A';
import { useEffect, useState } from 'react';

/** Shows a recovery code once, from sessionStorage, then forgets it. */
export function RecoveryCodeOnce({ recovered }: { recovered: boolean }) {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [next, setNext] = useState('/learn/day/1');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // sessionStorage exists only in the browser, so it is read after mount.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode(sessionStorage.getItem('jp_rc'));
      const n = sessionStorage.getItem('jp_next');
      if (n) setNext(n);
      sessionStorage.removeItem('jp_rc');
      sessionStorage.removeItem('jp_next');
    } catch {
      setCode(null);
    }
  }, []);

  if (code === undefined) return null;
  return (
    <div>
      {code ? (
        <>
          <p>{recovered ? 'You are signed in. Your old code no longer works; here is your new one.' : 'Here is your recovery code.'}</p>
          <CodeCard code={code} copied={copied} onCopy={() => setCopied(true)} />
        </>
      ) : (
        <p className="alert">
          Your recovery code was shown once and is no longer on this screen. You can make a new one on your <Link href="/account">account page</Link>.
        </p>
      )}
      <Link href={recovered ? '/learn' : next} className="btn btn-block">
        {recovered ? 'Open my 14 days' : 'Start Day 1'}
      </Link>
    </div>
  );
}

export function CodeCard({ code, copied, onCopy }: { code: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <p>
        <strong>Save this code. You need it to get back in on a new phone or after clearing your browser.</strong>
      </p>
      <p className="code-box" aria-label={`Recovery code ${code.split('').join(' ')}`}>
        {code}
      </p>
      <p className="small muted">Write it down or take a screenshot. We cannot show it again.</p>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            onCopy();
          } catch {
            /* clipboard blocked; the code is on screen */
          }
        }}
      >
        {copied ? 'Copied' : 'Copy code'}
      </button>
      <p className="sr-only" aria-live="polite">
        {copied ? 'Code copied' : ''}
      </p>
    </div>
  );
}
