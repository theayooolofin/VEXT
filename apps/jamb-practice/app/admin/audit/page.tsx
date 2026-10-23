import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { AdminShell } from '@/components/AdminShell';
import { one, requireAdmin, when, type SP } from '@/lib/adminPage';

export default async function AdminAudit({ searchParams }: { searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const sp = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(schema.adminAuditLog).orderBy(desc(schema.adminAuditLog.at)).limit(500);
  return (
    <AdminShell current="/admin/audit" title="Audit log" msg={one(sp.msg)} csrf={csrf}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Target</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{when(r.at)}</td>
                <td>{r.action}</td>
                <td className="small">{r.target}</td>
                <td className="small">{Object.keys(r.details).length ? JSON.stringify(r.details) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
