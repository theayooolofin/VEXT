import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { getDb, schema } from '@/db';
import { ActionForm, AdminShell } from '@/components/AdminShell';
import { money, one, requireAdmin, when, type SP } from '@/lib/adminPage';

const STATUSES = ['pending', 'paid', 'failed', 'abandoned', 'refunded', 'needs_review', 'duplicate'] as const;

export default async function AdminOrders({ searchParams }: { searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const sp = await searchParams;
  const status = one(sp.status) as (typeof STATUSES)[number] | '';
  const db = await getDb();
  const rows = await db
    .select({ o: schema.orders, s: schema.students })
    .from(schema.orders)
    .innerJoin(schema.students, eq(schema.students.id, schema.orders.studentId))
    .where(STATUSES.includes(status as never) ? eq(schema.orders.status, status as (typeof STATUSES)[number]) : undefined)
    .orderBy(desc(schema.orders.createdAt))
    .limit(200);
  const back = `/admin/orders${status ? `?status=${status}` : ''}`;

  return (
    <AdminShell current="/admin/orders" title="Orders" msg={one(sp.msg)} csrf={csrf}>
      <p className="row">
        <Link href="/admin/orders">All</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders?status=${s}`} aria-current={status === s ? 'page' : undefined}>
            {s.replace('_', ' ')}
          </Link>
        ))}
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Student</th>
              <th>Status</th>
              <th className="num">Amount</th>
              <th>Channel</th>
              <th>Created</th>
              <th>Paid</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, s }) => (
              <tr key={o.id}>
                <td>
                  {o.reference}
                  {o.isTest && <span className="badge">test</span>}
                  {o.verifyPayload != null && (
                    <details>
                      <summary className="small">Provider data</summary>
                      <pre className="small" style={{ whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(o.verifyPayload, null, 1)}
                      </pre>
                    </details>
                  )}
                </td>
                <td>
                  <Link href={`/admin/students/${s.id}`}>{s.firstName ?? '(deleted)'}</Link>
                </td>
                <td>
                  <span className={`badge ${o.status === 'paid' ? 'badge-ok' : o.status === 'needs_review' || o.status === 'duplicate' ? 'badge-bad' : ''}`}>
                    {o.status}
                  </span>
                </td>
                <td className="num">{money(o.amountKobo)}</td>
                <td>{o.channel}</td>
                <td>{when(o.createdAt)}</td>
                <td>{when(o.paidAt)}</td>
                <td>
                  {(o.status === 'pending' || o.status === 'failed' || o.status === 'abandoned') && (
                    <ActionForm action="reverify" csrf={csrf} back={back} fields={{ id: o.id }}>
                      <button className="btn btn-secondary">Re-verify</button>
                    </ActionForm>
                  )}
                  {o.status === 'needs_review' && (
                    <ActionForm action="resolve-review" csrf={csrf} back={back} fields={{ id: o.id }}>
                      <button className="btn">Grant after checking Paystack</button>
                    </ActionForm>
                  )}
                  {o.status === 'paid' && (
                    <ActionForm action="mark-duplicate" csrf={csrf} back={back} fields={{ id: o.id }}>
                      <button className="btn btn-secondary">Mark duplicate</button>
                    </ActionForm>
                  )}
                  {(o.status === 'paid' || o.status === 'duplicate' || o.status === 'needs_review') && (
                    <ActionForm action="refund" csrf={csrf} back={back} fields={{ id: o.id }}>
                      <button className="btn btn-danger">Mark refunded</button>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Refund in the Paystack dashboard first, then click Mark refunded. That revokes access.</p>
    </AdminShell>
  );
}
