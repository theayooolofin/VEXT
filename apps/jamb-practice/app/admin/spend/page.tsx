import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { ActionForm, AdminShell } from '@/components/AdminShell';
import { money, one, requireAdmin, type SP } from '@/lib/adminPage';
import { toLagosDate } from '@/lib/time';

export default async function AdminSpend({ searchParams }: { searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const sp = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(schema.adSpend).orderBy(desc(schema.adSpend.date)).limit(300);
  return (
    <AdminShell current="/admin/spend" title="Spend" msg={one(sp.msg)} csrf={csrf}>
      <p>Enter what you spent on each channel. Use the same name as the utm_source in your links (for example whatsapp, tiktok, instagram).</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <ActionForm action="spend-save" csrf={csrf} back="/admin/spend">
          <input type="date" name="date" className="input" defaultValue={toLagosDate(new Date())} required aria-label="Date" />
          <input name="channel" className="input" placeholder="channel" required aria-label="Channel" />
          <input name="amount" type="number" min="0" step="0.01" className="input" placeholder="₦ amount" required aria-label="Amount in naira" />
          <input name="note" className="input" placeholder="note" aria-label="Note" />
          <button className="btn" type="submit">
            Add
          </button>
        </ActionForm>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Channel</th>
              <th className="num">Amount</th>
              <th>Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{r.channel}</td>
                <td className="num">{money(r.amountKobo)}</td>
                <td>{r.note}</td>
                <td>
                  <ActionForm action="spend-delete" csrf={csrf} back="/admin/spend" fields={{ id: r.id }}>
                    <button className="btn btn-quiet">Delete</button>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
