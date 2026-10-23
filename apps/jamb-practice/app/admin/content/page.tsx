import { count, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { ActionForm, AdminShell } from '@/components/AdminShell';
import { one, requireAdmin, when, type SP } from '@/lib/adminPage';
import { allowUnreviewed, getContent } from '@/lib/content';
import { isServable } from '@/lib/contentStore';

const STATUS_LABEL = {
  missing: 'missing',
  invalid: 'invalid',
  draft: 'draft',
  approved: 'approved',
  edited_after_approval: 'edited after approval',
} as const;

export default async function AdminContent({ searchParams }: { searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const sp = await searchParams;
  const content = getContent();
  const allow = allowUnreviewed();
  const db = await getDb();
  const open = await db
    .select({ questionId: schema.questionReports.questionId, day: schema.questionReports.day, n: count() })
    .from(schema.questionReports)
    .where(eq(schema.questionReports.status, 'open'))
    .groupBy(schema.questionReports.questionId, schema.questionReports.day)
    .orderBy(desc(count()));
  const details = await db
    .select()
    .from(schema.questionReports)
    .where(eq(schema.questionReports.status, 'open'))
    .orderBy(desc(schema.questionReports.createdAt))
    .limit(500);
  const openByDay = new Map<number, number>();
  for (const r of open) openByDay.set(r.day, (openByDay.get(r.day) ?? 0) + r.n);

  const rows = [
    { label: 'Diagnostic', day: 0, item: content.diagnostic },
    ...[...content.lessons].map(([day, item]) => ({ label: `Day ${day}`, day, item })),
  ];

  return (
    <AdminShell current="/admin/content" title="Content" msg={one(sp.msg)} csrf={csrf}>
      <p className="small muted">
        Folder: {content.dir}. Unreviewed content is {allow ? 'ALLOWED (preview mode)' : 'hidden (production mode)'}.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Title</th>
              <th>Status</th>
              <th className="num">Questions</th>
              <th>Served</th>
              <th className="num">Open reports</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, day, item }) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{item.data && 'title' in item.data ? String(item.data.title) : ''}</td>
                <td>
                  <span className={`badge ${item.status === 'approved' ? 'badge-ok' : item.status === 'missing' ? '' : 'badge-warn'}`}>{STATUS_LABEL[item.status]}</span>
                  {item.isFixture && <span className="badge">fixture</span>}
                  {item.errors.length > 0 && <div className="small">{item.errors.slice(0, 3).join('; ')}</div>}
                </td>
                <td className="num">{item.data?.questions.length ?? ''}</td>
                <td>{isServable(item, allow) ? 'yes' : 'no'}</td>
                <td className="num">{openByDay.get(day) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 20 }}>Open reports by question</h2>
      {open.length === 0 && <p className="muted">No open reports.</p>}
      {open.map((r) => (
        <div key={r.questionId} className="card" style={{ marginBottom: 12 }}>
          <p>
            <strong>
              {r.day === 0 ? 'Diagnostic' : `Day ${r.day}`}, {r.questionId}
            </strong>{' '}
            · {r.n} report(s)
          </p>
          <ul className="small">
            {details
              .filter((d) => d.questionId === r.questionId)
              .slice(0, 10)
              .map((d) => (
                <li key={d.id}>
                  {d.reason.replaceAll('_', ' ')}
                  {d.message ? `: “${d.message}”` : ''} ({when(d.createdAt)}, version {d.lessonVersion})
                </li>
              ))}
          </ul>
          <ActionForm action="report-status" csrf={csrf} back="/admin/content" fields={{ questionId: r.questionId }}>
            <input name="note" className="input" placeholder="Note (what you did)" maxLength={300} />
            <button name="status" value="fixed" className="btn">
              Mark fixed
            </button>
            <button name="status" value="dismissed" className="btn btn-secondary">
              Dismiss
            </button>
          </ActionForm>
        </div>
      ))}
    </AdminShell>
  );
}
