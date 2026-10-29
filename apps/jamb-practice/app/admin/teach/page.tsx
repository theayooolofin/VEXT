import { A as Link } from '@/components/A';
import { AdminShell } from '@/components/AdminShell';
import { one, requireAdmin, type SP } from '@/lib/adminPage';
import { allowUnreviewed, getContent } from '@/lib/content';
import { isServable } from '@/lib/contentStore';

export default async function AdminTeach({ searchParams }: { searchParams: SP }) {
  const { csrf } = await requireAdmin();
  const sp = await searchParams;
  const content = getContent();
  const allow = allowUnreviewed();
  const days = [...content.lessons].filter(([, item]) => item.data);

  return (
    <AdminShell current="/admin/teach" title="Teach" msg={one(sp.msg)} csrf={csrf}>
      <p className="muted">
        Show a day on a projector or TV and go through it with a class. It opens on the day&apos;s
        title; press Space to move on and F to fill the screen.
      </p>
      <ul className="days">
        {days.map(([day, item]) => (
          <li key={day} className="day-row">
            <span className="day-num">{day}</span>
            <span className="day-main">
              <span className="day-title">{item.data!.title}</span>
              <span className="day-state">
                {isServable(item, allow)
                  ? 'Students can see this day'
                  : 'Waiting for approval; students cannot see it yet'}
              </span>
            </span>
            <Link href={`/admin/teach/${day}`} className="btn btn-secondary">
              Teach Day {day}
            </Link>
          </li>
        ))}
      </ul>
      {days.length === 0 && <p>No lessons are in the content folder yet.</p>}
    </AdminShell>
  );
}
