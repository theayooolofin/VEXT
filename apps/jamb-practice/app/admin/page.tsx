import Link from 'next/link';
import { getDb, schema } from '@/db';
import { AdminShell } from '@/components/AdminShell';
import { money, one, requireAdmin, when, type SP } from '@/lib/adminPage';
import { channels, funnel, gates, todayStrip, type GateStatus } from '@/lib/stats';
import { getSettings } from '@/lib/settingsRepo';
import { env } from '@/lib/env';
import { lagosDateTime, toLagosDate, addDays } from '@/lib/time';

function badge(s: GateStatus) {
  const cls = s === 'passed' ? 'badge-ok' : s === 'failed' ? 'badge-bad' : s === 'on track' ? 'badge-warn' : '';
  return <span className={`badge ${cls}`}>{s}</span>;
}

export default async function AdminOverview({ searchParams }: { searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const sp = await searchParams;
  const settings = await getSettings();
  const now = new Date();
  const today = toLagosDate(now);
  const fromStr = one(sp.from) || addDays(today, -30);
  const toStr = one(sp.to) || today;
  const source = one(sp.source) || undefined;
  const cohortId = one(sp.cohort) || undefined;
  const range = { from: lagosDateTime(fromStr, '00:00'), to: lagosDateTime(addDays(toStr, 1), '00:00') };

  const db = await getDb();
  const [strip, stages, chans, g, cohorts] = await Promise.all([
    todayStrip(settings, now),
    funnel({ ...range, source, cohortId }),
    channels(range),
    gates(settings, now),
    db.select().from(schema.cohorts),
  ]);
  const a = strip.alerts;
  const alerts = [
    a.needsReview && <Link href="/admin/orders?status=needs_review">{a.needsReview} order(s) need review</Link>,
    a.duplicates && <Link href="/admin/orders?status=duplicate">{a.duplicates} duplicate payment(s) to refund</Link>,
    a.unavailableDays.length > 0 && <Link href="/admin/content">Unlocked but unavailable: Day {a.unavailableDays.join(', ')}</Link>,
    a.openReports && <Link href="/admin/content">{a.openReports} open question report(s)</Link>,
    a.webhookSignatureFailures && <span>{a.webhookSignatureFailures} webhook signature failure(s) in 24 hours</span>,
    a.failedPushes && <span>{a.failedPushes} failed push reminder(s) in 24 hours</span>,
  ].filter(Boolean);

  return (
    <AdminShell current="/admin" title="Overview" msg={one(sp.msg)} csrf={csrf}>
      <h2>Today</h2>
      <div className="grid">
        <div className="stat">
          Signups today<div className="n">{strip.signupsToday}</div>
        </div>
        <div className="stat">
          Paid today<div className="n">{strip.paidToday}</div>
        </div>
        <div className="stat">
          Active today<div className="n">{strip.activeToday}</div>
        </div>
      </div>
      <h2 style={{ marginTop: 20 }}>Alerts</h2>
      {alerts.length ? (
        <ul>
          {alerts.map((el, i) => (
            <li key={i}>{el}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nothing needs attention.</p>
      )}

      <h2 style={{ marginTop: 20 }}>The four gates</h2>
      <div className="grid">
        <div className="stat">
          <strong>Gate 1: problem check</strong> {badge(g.gate1.status)}
          <p>
            {g.gate1.confirmed} of {g.gate1.done} interviews confirm the problem (target 10 of 15). <Link href="/admin/settings">Edit</Link>
          </p>
        </div>
        <div className="stat">
          <strong>Gate 2: will they pay</strong> {badge(g.gate2.status)}
          <p>
            {g.gate2.paid} of {g.gate2.target} paid in the pre-sale
            {g.gate2.window ? ` (${when(g.gate2.window.from)} to ${when(g.gate2.window.to)})` : ''}.
          </p>
        </div>
        {g.gate3.length === 0 && (
          <div className="stat">
            <strong>Gate 3: does it work</strong> {badge('waiting')}
            <p>No cohorts yet.</p>
          </div>
        )}
        {g.gate3.map((c) => (
          <div className="stat" key={c.cohortId}>
            <strong>Gate 3: {c.cohort}</strong> {badge(c.status)}
            <p>
              Active on Day 7: {c.day7ActivePct}% (target {settings.gate3_day7_active_pct}%)
              <br />
              Finished Day 14: {c.day14FinishPct}% (target {settings.gate3_day14_finish_pct}%)
              <br />
              Refunds: {c.refundPct}% (max {settings.gate3_refund_max_pct}%)
              <br />
              {c.paid} paid students. {c.status === 'waiting' ? `Judged after Day 14 opens (${when(c.day14UnlocksAt)}).` : ''}
            </p>
          </div>
        ))}
        <div className="stat">
          <strong>Gate 4: can it grow</strong> {badge(g.gate4.status)}
          <p>
            Add-on or referral: {g.gate4.extraPct}% of {g.gate4.buyers} buyers (target {settings.gate4_extra_pct}%)
            <br />
            Channels at or under {money(settings.gate4_cac_max_kobo)} per paying customer with {settings.gate4_min_orders}+ orders:{' '}
            {g.gate4.cheapChannels.join(', ') || 'none yet'}
          </p>
        </div>
      </div>

      <h2 style={{ marginTop: 20 }}>Funnel</h2>
      <form method="get" className="inline-form" style={{ marginBottom: 12 }}>
        <label>
          From <input type="date" name="from" defaultValue={fromStr} className="input" />
        </label>
        <label>
          To <input type="date" name="to" defaultValue={toStr} className="input" />
        </label>
        <label>
          Source <input name="source" defaultValue={source ?? ''} placeholder="all" className="input" size={10} />
        </label>
        <label>
          Cohort{' '}
          <select name="cohort" defaultValue={cohortId ?? ''} className="input">
            <option value="">all</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit">
          Apply
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th className="num">Count</th>
              <th className="num">% of previous</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.label}>
                <td>{s.label}</td>
                <td className="num">{s.n}</td>
                <td className="num">{s.pctOfPrev == null ? '' : `${s.pctOfPrev}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Cohort filter applies to checkout and paid. Test payments are excluded.</p>

      <h2 style={{ marginTop: 20 }}>By channel</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th className="num">Visitors</th>
              <th className="num">Signups</th>
              <th className="num">Paid</th>
              <th className="num">Spend</th>
              <th className="num">Cost per paying customer</th>
            </tr>
          </thead>
          <tbody>
            {chans.map((c) => (
              <tr key={c.source}>
                <td>{c.source}</td>
                <td className="num">{c.visitors}</td>
                <td className="num">{c.signups}</td>
                <td className="num">{c.paid}</td>
                <td className="num">{c.spendKobo == null ? 'no spend' : money(c.spendKobo)}</td>
                <td className="num">{c.cacKobo == null ? '' : money(c.cacKobo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 20 }}>Exports</h2>
      <p className="row">
        <a href={`${env().BASE_PATH}/admin/export/orders?from=${fromStr}&to=${toStr}`}>Orders CSV</a>
        <a href={`${env().BASE_PATH}/admin/export/students?from=${fromStr}&to=${toStr}`}>Students CSV</a>
        <a href={`${env().BASE_PATH}/admin/export/funnel?from=${fromStr}&to=${toStr}`}>Funnel CSV</a>
      </p>
    </AdminShell>
  );
}
