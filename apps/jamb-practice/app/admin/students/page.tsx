import { desc, ilike, isNull, like, or, and } from 'drizzle-orm';
import Link from 'next/link';
import { getDb, schema } from '@/db';
import { AdminShell } from '@/components/AdminShell';
import { one, requireAdmin, when, type SP } from '@/lib/adminPage';

export default async function AdminStudents({ searchParams }: { searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 40);
  const db = await getDb();
  const digits = q.replace(/\D/g, '');
  const where = q
    ? or(ilike(schema.students.firstName, `%${q.replace(/[%_]/g, '')}%`), digits.length >= 3 ? like(schema.students.phoneE164, `%${digits}`) : undefined)
    : undefined;
  const rows = await db
    .select()
    .from(schema.students)
    .where(and(isNull(schema.students.deletedAt), where))
    .orderBy(desc(schema.students.createdAt))
    .limit(100);

  return (
    <AdminShell current="/admin/students" title="Students" msg={one(sp.msg)} csrf={csrf}>
      <form method="get" className="inline-form" style={{ marginBottom: 12 }}>
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Name or last digits of phone" className="input" />
        <button className="btn" type="submit">
          Search
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Class</th>
              <th>Source</th>
              <th>Signed up</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/admin/students/${s.id}`}>{s.firstName}</Link>
                </td>
                <td>…{s.phoneE164?.slice(-4)}</td>
                <td>{s.classLevel}</td>
                <td>{s.firstTouch.utm_source ?? 'direct'}</td>
                <td>{when(s.createdAt)}</td>
                <td>{when(s.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Showing up to 100 students, newest first.</p>
    </AdminShell>
  );
}
