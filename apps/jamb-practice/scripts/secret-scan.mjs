// npm run secret-scan. Fails if a tracked file looks like it contains a secret.
// A small built-in check; swap for gitleaks or similar if the owner prefers.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const PATTERNS = [
  [/sk_(live|test)_[A-Za-z0-9]{20,}/, 'Paystack secret key'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/postgres(ql)?:\/\/[^\s'"]+:[^\s'"@]+@[^\s'"]+/, 'database URL with a password'],
  [/^(SESSION_SECRET|IP_HASH_SALT|CRON_SECRET|VAPID_PRIVATE_KEY|PAYSTACK_SECRET_KEY)=\S{8,}/m, 'secret in an env file'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
];

const root = execSync('git rev-parse --show-toplevel').toString().trim();
const files = execSync('git ls-files -z', { cwd: root }).toString().split('\0').filter(Boolean);
const hits = [];
for (const f of files) {
  if (/\.(png|jpg|ico|webp|lock)$|package-lock\.json$/.test(f)) continue;
  let text;
  try {
    text = fs.readFileSync(`${root}/${f}`, 'utf8');
  } catch {
    continue;
  }
  for (const [re, what] of PATTERNS) if (re.test(text)) hits.push(`${f}: looks like a ${what}`);
}
if (hits.length) {
  console.error(hits.join('\n'));
  process.exit(1);
}
console.log(`Secret scan clean (${files.length} tracked files).`);
