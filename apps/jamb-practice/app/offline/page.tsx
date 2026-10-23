import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'You are offline' };
// Precached by the service worker; must not depend on the database.
export default function OfflinePage() {
  return (
    <main id="main">
      <div className="wrap">
        <h1>You are offline</h1>
        <p>This page needs a connection. Lessons you have already opened still work: go back and open them from your 14 days.</p>
        <p>Your answers are saved and will sync when you reconnect.</p>
        <a href="./learn" className="btn">
          Go to my 14 days
        </a>
      </div>
    </main>
  );
}
