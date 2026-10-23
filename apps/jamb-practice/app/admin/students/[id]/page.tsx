import { desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDb, schema } from '@/db';
import { ActionForm, AdminShell } from '@/components/AdminShell';
import { getAccess } from '@/lib/access';
import { money, one, requireAdmin, when, type SP } from '@/lib/adminPage';
import { dashboard } from '@/lib/lessons';
import { dayLabel } from '@/lib/dayLabels';
import { getSettings } from '@/lib/settingsRepo';
import { whatsappLink } from '@/lib/rules';

export default async function AdminStudent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sp = await searchParams;
  const db = await getDb();
  const s = await db.query.students.findFirst({ where: eq(schema.students.id, id) });
  if (!s) notFound();
  const settings = await getSettings();
  const back = `/admin/students/${id}`;
  const [access, orders, reports, support, cohorts, ents] = await Promise.all([
    getAccess(id),
    db.select().from(schema.orders).where(eq(schema.orders.studentId, id)).orderBy(desc(schema.orders.createdAt)),
    db.select().from(schema.questionReports).where(eq(schema.questionReports.studentId, id)),
    db.select().from(schema.supportRequests).where(eq(schema.supportRequests.studentId, id)),
    db.select().from(schema.cohorts),
    db.select().from(schema.entitlements).where(eq(schema.entitlements.studentId, id)),
  ]);
  const { states } = await dashboard(s, settings);

  return (
    <AdminShell current="/admin/students" title={s.deletedAt ? 'Deleted student' : (s.firstName ?? 'Student')} msg={one(sp.msg)} csrf={csrf}>
      <p>
        Phone {s.phoneE164 ?? '(deleted)'} {s.phoneE164 && <a href={whatsappLink(s.phoneE164)}>Open WhatsApp</a>} · Class {s.classLevel} · Signed up{' '}
        {when(s.createdAt)} · Source {s.firstTouch.utm_source ?? 'direct'}
      </p>
      <p>
        Access:{' '}
        {access.active ? (
          <span className="badge badge-ok">
            {access.active.cohortName}, until {when(access.active.expiresAt)}
          </span>
        ) : (
          <span className="badge">free days only</span>
        )}
      </p>

      <h2>Progress</h2>
      <div className="table-wrap">
        <table>
          <tbody>
            {states.map((d) => (
              <tr key={d.day}>
                <td>Day {d.day}</td>
                <td>{dayLabel(d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 20 }}>Orders</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Status</th>
              <th className="num">Amount</th>
              <th>Created</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.reference}</td>
                <td>{o.status}</td>
                <td className="num">{money(o.amountKobo)}</td>
                <td>{when(o.createdAt)}</td>
                <td>{when(o.paidAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        Entitlements: {ents.map((e) => `${e.source}${e.revokedAt ? ' (revoked)' : ''}`).join(', ') || 'none'}
      </p>

      {!s.deletedAt && (
        <>
          <h2 style={{ marginTop: 20 }}>Actions</h2>
          <div className="stack">
            {!access.active ? (
              <ActionForm action="grant" csrf={csrf} back={back} fields={{ id }}>
                <select name="cohortId" className="input" required defaultValue="">
                  <option value="" disabled>
                    Cohort
                  </option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.startDate})
                    </option>
                  ))}
                </select>
                <input name="note" className="input" placeholder="Why (required)" required maxLength={300} />
                <button className="btn" type="submit">
                  Grant access
                </button>
              </ActionForm>
            ) : (
              <ActionForm action="revoke" csrf={csrf} back={back} fields={{ id }}>
                <input name="note" className="input" placeholder="Why" maxLength={300} />
                <button className="btn btn-secondary" type="submit">
                  Revoke access
                </button>
              </ActionForm>
            )}
            <ActionForm action="recovery-code" csrf={csrf} back={back} fields={{ id }}>
              <button className="btn btn-secondary" type="submit">
                Issue a new recovery code
              </button>
              <span className="small muted">Check it is really them first (for example, the WhatsApp number matches).</span>
            </ActionForm>
            <ActionForm action="delete-student" csrf={csrf} back={back} fields={{ id }}>
              <input name="confirm" className="input" placeholder="Type DELETE" autoComplete="off" />
              <button className="btn btn-danger" type="submit">
                Delete data
              </button>
            </ActionForm>
          </div>
        </>
      )}

      <h2 style={{ marginTop: 20 }}>Reports and support</h2>
      <ul>
        {reports.map((r) => (
          <li key={r.id}>
            Report on {r.questionId}: {r.reason} ({r.status})
          </li>
        ))}
        {support.map((r) => (
          <li key={r.id}>
            {r.type} request: {r.status} {when(r.createdAt)}
          </li>
        ))}
        {!reports.length && !support.length && <li className="muted">None.</li>}
      </ul>
    </AdminShell>
  );
}
