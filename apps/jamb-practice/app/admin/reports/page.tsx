import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { getDb, schema } from '@/db';
import { ActionForm, AdminShell } from '@/components/AdminShell';
import { one, requireAdmin, when, type SP } from '@/lib/adminPage';

export default async function AdminSupport({ searchParams }: { searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const sp = await searchParams;
  const db = await getDb();
  const rows = await db
    .select({ r: schema.supportRequests, s: schema.students })
    .from(schema.supportRequests)
    .leftJoin(schema.students, eq(schema.students.id, schema.supportRequests.studentId))
    .orderBy(desc(schema.supportRequests.createdAt))
    .limit(300);
  return (
    <AdminShell current="/admin/reports" title="Support requests" msg={one(sp.msg)} csrf={csrf}>
      <p>Refund, help, deletion and recovery requests from the site. Question reports are on the content page.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Student</th>
              <th>Phone ends</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, s }) => (
              <tr key={r.id}>
                <td>{when(r.createdAt)}</td>
                <td>{r.type}</td>
                <td>{s ? <Link href={`/admin/students/${s.id}`}>{s.firstName ?? '(deleted)'}</Link> : 'not signed in'}</td>
                <td>{r.phoneHint}</td>
                <td>{r.message}</td>
                <td>
                  {r.status === 'open' ? (
                    <ActionForm action="support-done" csrf={csrf} back="/admin/reports" fields={{ id: r.id }}>
                      <button className="btn btn-secondary">Done</button>
                    </ActionForm>
                  ) : (
                    `done ${when(r.handledAt)}`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
