import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { ActionForm, AdminShell } from '@/components/AdminShell';
import { one, requireAdmin, type SP } from '@/lib/adminPage';
import { isEnrollmentOpen } from '@/lib/rules';
import { toLagosLocalInput } from '@/lib/time';

export default async function AdminCohorts({ searchParams }: { searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const sp = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(schema.cohorts).orderBy(desc(schema.cohorts.startDate));
  const now = new Date();

  const fields = (c?: (typeof rows)[number]) => (
    <>
      <input name="name" className="input" defaultValue={c?.name} placeholder="Name" required maxLength={80} aria-label="Name" />
      <label>
        Starts <input type="date" name="startDate" className="input" defaultValue={c?.startDate} required />
      </label>
      <label>
        Enrolment opens <input type="datetime-local" name="opens" className="input" defaultValue={c ? toLagosLocalInput(c.enrollmentOpensAt) : ''} required />
      </label>
      <label>
        closes <input type="datetime-local" name="closes" className="input" defaultValue={c ? toLagosLocalInput(c.enrollmentClosesAt) : ''} required />
      </label>
      <label className="check">
        <input type="checkbox" name="active" defaultChecked={c ? c.active : true} /> Active
      </label>
    </>
  );

  return (
    <AdminShell current="/admin/cohorts" title="Cohorts" msg={one(sp.msg)} csrf={csrf}>
      <p>Times are Lagos time. Day 4 opens on the start date at the unlock time; buyers join the cohort open when they check out.</p>
      {rows.map((c) => (
        <div key={c.id} className="card" style={{ marginBottom: 12 }}>
          <p>
            <strong>{c.name}</strong> {isEnrollmentOpen(c, now) ? <span className="badge badge-ok">enrolment open</span> : <span className="badge">closed</span>}
          </p>
          <ActionForm action="cohort-save" csrf={csrf} back="/admin/cohorts" fields={{ id: c.id }}>
            {fields(c)}
            <button className="btn" type="submit">
              Save
            </button>
          </ActionForm>
        </div>
      ))}
      <h2>New cohort</h2>
      <div className="card">
        <ActionForm action="cohort-save" csrf={csrf} back="/admin/cohorts">
          {fields()}
          <button className="btn" type="submit">
            Create
          </button>
        </ActionForm>
      </div>
    </AdminShell>
  );
}
