import Link from 'next/link';
import { ActionForm, AdminShell } from '@/components/AdminShell';
import { one, requireAdmin, when, type SP } from '@/lib/adminPage';
import { renderTemplate, whatsappLink } from '@/lib/rules';
import { getSettings } from '@/lib/settingsRepo';
import { nudgeList } from '@/lib/stats';

export default async function AdminNudges({ searchParams }: { searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const sp = await searchParams;
  const settings = await getSettings();
  const rows = await nudgeList(settings);
  return (
    <AdminShell current="/admin/nudges" title="Nudges" msg={one(sp.msg)} csrf={csrf}>
      <p>
        Paid students who have not started either of their last two unlocked days. Open WhatsApp, send the message, then mark it. Edit the message on the{' '}
        <Link href="/admin/settings">settings page</Link>.
      </p>
      {rows.length === 0 && <p className="muted">Nobody needs a nudge right now.</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Last active</th>
              <th className="num">Finished up to</th>
              <th>Last nudge</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const text = renderTemplate(settings.nudge_template, { firstName: r.firstName, day: r.nextDay });
              return (
                <tr key={r.studentId}>
                  <td>
                    <Link href={`/admin/students/${r.studentId}`}>{r.firstName}</Link>
                  </td>
                  <td>{when(r.lastSeenAt) || 'never'}</td>
                  <td className="num">{r.reachedDay ? `Day ${r.reachedDay}` : 'none'}</td>
                  <td>{r.lastNudge ? `Day ${r.lastNudge.day}, ${when(r.lastNudge.sentAt)}` : ''}</td>
                  <td>
                    <a className="btn btn-secondary" href={whatsappLink(r.phone, text)} target="_blank" rel="noopener">
                      Open WhatsApp
                    </a>{' '}
                    <ActionForm action="nudge-mark" csrf={csrf} back="/admin/nudges" fields={{ id: r.studentId, day: String(r.nextDay) }}>
                      <button className="btn btn-quiet">Mark nudged</button>
                    </ActionForm>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
