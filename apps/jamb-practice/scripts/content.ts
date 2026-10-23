// Content tools for the owner and teacher.
//   npm run content:validate [-- --dir <path>] [--strict]
//   npm run content:approve -- --day 4 --reviewer "Name"     (or --day diagnostic)
//   npm run content:import -- lessons.csv rules.csv [--dir <path>]
// See docs/CONTENT_GUIDE.md.
import fs from 'node:fs';
import path from 'node:path';
import { loadContentSet, lessonFileName } from '../src/lib/contentStore';
import { contentHash, DAYS } from '../src/lib/contentRules';
import { parseCsv } from '../src/lib/csv';
import type { ReviewEntry } from '../src/lib/contentSchema';

const args = process.argv.slice(2);
const cmd = args.shift();
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name: string) => args.includes(`--${name}`);
const dir = path.resolve(flag('dir') ?? process.env.CONTENT_DIR ?? 'content/jamb-english');

function validate(): number {
  const set = loadContentSet(dir);
  const strict = has('strict');
  let errors = [...set.errors];
  const warnings: string[] = [];
  const lines: string[] = [];
  const show = (label: string, item: { status: string; errors: string[]; warnings: string[]; review?: ReviewEntry }) => {
    lines.push(`  ${label.padEnd(12)} ${item.status}`);
    errors = errors.concat(item.errors);
    warnings.push(...item.warnings);
    // An approved ("live") item that has gone missing is a failure.
    if (item.status === 'missing' && item.review) errors.push(`${label}: approved in review.json but the file is missing`);
    if (strict && item.status === 'edited_after_approval') errors.push(`${label}: edited after approval; re-approve before release`);
  };
  show('Diagnostic', set.diagnostic);
  for (const d of DAYS) show(`Day ${d}`, set.lessons.get(d)!);
  console.log(`Content in ${path.relative(process.cwd(), dir) || '.'}:`);
  console.log(lines.join('\n'));
  for (const w of warnings) console.log(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  if (errors.length) {
    console.error(`\n${errors.length} problem(s). Fix them and run again.`);
    return 1;
  }
  console.log('\nContent is valid.');
  return 0;
}

function approve(): number {
  const dayArg = flag('day');
  const reviewer = flag('reviewer');
  if (!dayArg || !reviewer) {
    console.error('Usage: npm run content:approve -- --day <1-14|diagnostic> --reviewer "Name"');
    return 1;
  }
  const day: number | 'diagnostic' = dayArg === 'diagnostic' ? 'diagnostic' : Number(dayArg);
  if (day !== 'diagnostic' && !DAYS.includes(day)) {
    console.error('Day must be 1 to 14 or "diagnostic".');
    return 1;
  }
  const set = loadContentSet(dir);
  const item = day === 'diagnostic' ? set.diagnostic : set.lessons.get(day)!;
  if (item.status === 'missing' || item.status === 'invalid' || !item.hash) {
    console.error(`Cannot approve: the file is ${item.status}.`);
    for (const e of item.errors) console.error(`error: ${e}`);
    return 1;
  }
  if (item.isFixture) {
    console.error('Cannot approve fixture content.');
    return 1;
  }
  const entry: ReviewEntry = {
    day,
    status: 'teacher_approved',
    reviewer,
    reviewedAt: new Date().toISOString().slice(0, 10),
    contentHash: item.hash,
  };
  const review = set.review.filter((r) => r.day !== day).concat(entry);
  review.sort((a, b) => (a.day === 'diagnostic' ? -1 : b.day === 'diagnostic' ? 1 : a.day - b.day));
  fs.writeFileSync(path.join(dir, 'review.json'), `${JSON.stringify(review, null, 2)}\n`);
  console.log(`Approved ${day === 'diagnostic' ? 'the diagnostic' : `Day ${day}`} for ${reviewer} (hash ${item.hash.slice(0, 12)}...).`);
  return 0;
}

function importCsv(): number {
  const [lessonsCsv, rulesCsv] = args.filter((a) => !a.startsWith('--') && a !== flag('dir'));
  if (!lessonsCsv || !rulesCsv) {
    console.error('Usage: npm run content:import -- path/to/lessons.csv path/to/rules.csv');
    return 1;
  }
  const lessonRows = parseCsv(fs.readFileSync(lessonsCsv, 'utf8'));
  const ruleRows = parseCsv(fs.readFileSync(rulesCsv, 'utf8'));
  const need = (rows: Record<string, string>[], cols: string[], file: string) => {
    const missing = cols.filter((c) => rows.length && !(c in rows[0]!));
    if (missing.length) throw new Error(`${file} is missing columns: ${missing.join(', ')}`);
  };
  need(lessonRows, ['day', 'question_no', 'stem', 'A', 'B', 'C', 'D', 'answer', 'explanation', 'difficulty', 'topic_tag', 'passage_id'], lessonsCsv);
  need(ruleRows, ['day', 'title', 'topic_tag', 'rule_text', 'example_text'], rulesCsv);

  let written = 0;
  for (const rule of ruleRows) {
    const day = Number(rule.day);
    if (!DAYS.includes(day)) throw new Error(`rules.csv: bad day "${rule.day}"`);
    const dd = String(day).padStart(2, '0');
    const file = path.join(dir, 'lessons', lessonFileName(day));
    const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    const questions = lessonRows
      .filter((r) => Number(r.day) === day)
      .sort((a, b) => Number(a.question_no) - Number(b.question_no))
      .map((r) => ({
        id: `d${dd}-q${String(Number(r.question_no)).padStart(2, '0')}`,
        stem: r.stem!.trim(),
        options: { A: r.A!.trim(), B: r.B!.trim(), C: r.C!.trim(), D: r.D!.trim() },
        answer: r.answer!.trim().toUpperCase(),
        explanation: r.explanation!.trim(),
        difficulty: r.difficulty!.trim().toLowerCase(),
        topicTag: r.topic_tag!.trim(),
        passageId: r.passage_id?.trim() || null,
      }));
    const next = {
      day,
      slug: previous?.slug ?? rule.title!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      title: rule.title!.trim(),
      topicTag: rule.topic_tag!.trim(),
      version: previous?.version ?? 1,
      rule: { body: rule.rule_text!.trim(), example: rule.example_text!.trim() },
      passages: previous?.passages ?? [],
      questions,
    };
    // Bump the version only when the content really changed.
    if (previous) {
      const strip = (l: typeof next) => ({ ...l, version: 0 });
      if (contentHash(strip(previous)) !== contentHash(strip(next))) next.version = (previous.version ?? 1) + 1;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
    written++;
  }
  console.log(`Imported ${written} lesson file(s). Approval is never set by import.\n`);
  return validate();
}

const run = { validate, approve, import: importCsv }[cmd ?? ''];
if (!run) {
  console.error('Commands: validate, approve, import');
  process.exit(1);
}
try {
  process.exit(run());
} catch (e) {
  console.error(`error: ${(e as Error).message}`);
  process.exit(1);
}
