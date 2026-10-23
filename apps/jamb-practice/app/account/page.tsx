import type { Metadata } from 'next';
import { A as Link } from '@/components/A';
import { DeleteAccount, NewRecoveryCode, PushSettings, SignOut } from '@/components/AccountActions';
import { Page } from '@/components/Shell';
import { Track } from '@/components/Track';
import { getAccess } from '@/lib/access';
import { env } from '@/lib/env';
import { requirePageSession } from '@/lib/page';
import { formatLongDay } from '@/lib/time';

export const metadata: Metadata = { title: 'Your account' };

const CLASS_LABEL = { ss3: 'SS3', ss2_or_below: 'SS2 or below', graduate: 'Finished secondary school', other: 'Other' } as const;

export default async function AccountPage() {
  const session = await requirePageSession('/account');
  const s = session.student;
  const access = await getAccess(s.id);
  return (
    <Page>
      <Track />
      <h1>Your account</h1>
      <section aria-labelledby="profile">
        <h2 id="profile">Your details</h2>
        <ul className="breakdown">
          <li>
            <span>First name</span>
            <span>{s.firstName}</span>
          </li>
          <li>
            <span>Phone</span>
            <span>ending {s.phoneE164?.slice(-4)}</span>
          </li>
          <li>
            <span>Class</span>
            <span>{s.classLevel ? CLASS_LABEL[s.classLevel] : ''}</span>
          </li>
          <li>
            <span>Pack</span>
            <span>
              {access.active ? (
                `Full pack until ${formatLongDay(access.active.expiresAt)}`
              ) : (
                <Link href="/buy">Days 1 to 3 (free)</Link>
              )}
            </span>
          </li>
        </ul>
      </section>
      <section aria-labelledby="reminders">
        <h2 id="reminders">Reminders</h2>
        <PushSettings vapidPublicKey={env().VAPID_PUBLIC_KEY ?? null} />
      </section>
      <section aria-labelledby="recovery">
        <h2 id="recovery">Recovery code</h2>
        <p>You need your recovery code to sign in on a new phone. If you lost it, make a new one; the old one stops working.</p>
        <NewRecoveryCode />
      </section>
      <section aria-labelledby="signout">
        <h2 id="signout">Sign out</h2>
        <p>Signing out removes your saved lessons from this phone. Keep your recovery code to sign back in.</p>
        <SignOut />
      </section>
      <section aria-labelledby="delete">
        <h2 id="delete">Delete my data</h2>
        <p>This removes your name, phone number, email and sign-in details. Payment records are kept as financial records. This cannot be undone.</p>
        <DeleteAccount />
      </section>
    </Page>
  );
}
