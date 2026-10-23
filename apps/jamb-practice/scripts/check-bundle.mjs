// npm run check:bundle (after a build). Fails if any paid-day lesson text
// (Days 4 to 14) appears in the client bundle or in public/.
import fs from 'node:fs';
import path from 'node:path';

const dirs = ['content/jamb-english/lessons', 'content/jamb-english/_fixtures/lessons'];
const needles = new Set();
for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const m = /^day-(\d{2})\.json$/.exec(f);
    if (!m || Number(m[1]) < 4) continue;
    const lesson = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    needles.add(lesson.rule?.body);
    for (const q of lesson.questions ?? []) {
      needles.add(q.id);
      if (q.explanation && q.explanation.length > 20) needles.add(q.explanation);
    }
  }
}
needles.delete(undefined);

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

if (!fs.existsSync('.next/static')) {
  console.error('No build found. Run the build first.');
  process.exit(1);
}
let files = 0;
const hits = [];
for (const root of ['.next/static', 'public']) {
  for (const file of walk(root)) {
    if (!/\.(js|css|html|json|txt|map|webmanifest)$/.test(file)) continue;
    files++;
    const text = fs.readFileSync(file, 'utf8');
    for (const n of needles) if (text.includes(n)) hits.push(`${file}: contains "${String(n).slice(0, 60)}"`);
  }
}
if (hits.length) {
  console.error(`Paid lesson content found in public output:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`OK: searched ${files} client and public files for ${needles.size} paid-day strings; none found.`);
