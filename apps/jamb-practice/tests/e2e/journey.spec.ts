import { expect, test, type Browser, type Page } from '@playwright/test';

// One student's whole journey on a 360x740 phone viewport (spec 13.3), plus
// the admin checks that depend on it. Runs in order on one database.
test.describe.configure({ mode: 'serial' });

const ADMIN_PASSWORD = 'e2e admin password';
const PHONE = '0803 555 0101';
let page: Page;
let recoveryCode = '';

// The cohort starts a week from today, so the test never goes stale.
const start = new Date(Date.now() + 7 * 86_400_000);
const START_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(start);
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', ...o }).format(start).replace(',', '');
const START_LONG = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const START_SHORT = fmt({ weekday: 'short', day: 'numeric', month: 'short' });

async function pick(p: Page, letter: string) {
  // Tap the answer bubble, as a student would.
  const radio = p.getByRole('radio', { name: new RegExp(`^Option ${letter}:`) });
  await p.locator('label.option').filter({ has: radio }).click();
  await expect(radio).toBeChecked();
}

async function adminPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('admin/login');
  await p.getByLabel('Password').fill(ADMIN_PASSWORD);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await expect(p.getByRole('heading', { name: 'Overview' })).toBeVisible();
  return p;
}

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  // Enrolment for the seeded cohort opens on 2 Nov 2026; open it now through
  // the admin page so checkout can be tested today.
  const admin = await adminPage(browser);
  await admin.goto('admin/cohorts');
  const card = admin.locator('.card').filter({ hasText: 'Founding cohort' });
  await card.locator('input[name="opens"]').fill('2026-01-01T00:00');
  await card.locator('input[name="startDate"]').fill(START_DATE);
  await card.locator('input[name="closes"]').fill(`${START_DATE}T00:00`);
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(admin.getByText('Cohort saved.')).toBeVisible();
  await admin.context().close();
});

test('1. landing: answer the hero question and see it marked', async () => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Practise UTME English for 14 days. Ten minutes a day.' })).toBeVisible();
  await expect(page.getByText('This site is not affiliated with JAMB.', { exact: true })).toBeVisible();
  await pick(page, 'A');
  await expect(page.getByText('Not quite. The answer is B.')).toBeVisible();
  await expect(page.locator('.question-card .feedback')).toContainText("'students' is plural");
  await page.getByRole('link', { name: 'Take the free check', exact: true }).click();
  await expect(page).toHaveURL(/\/check$/);
});

test('2. diagnostic: 10 questions, then score and weakest topic', async () => {
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByText(`${i} of 10`, { exact: true })).toBeVisible();
    await pick(page, i <= 2 ? 'B' : 'A');
    await page.getByRole('button', { name: i === 10 ? 'See my result' : 'Next question' }).click();
  }
  await expect(page).toHaveURL(/\/check\/result$/);
  await expect(page.getByText(/You got \d+ out of 10\./)).toBeVisible();
  await expect(page.getByText(/Your weakest topic was/)).toBeVisible();
  await page.getByRole('link', { name: 'Save my result and start Day 1' }).click();
});

test('3. signup: recovery code shown once, then Day 1', async () => {
  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Phone number').fill('12345');
  await page.getByLabel('Class').selectOption('ss3');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save my result and start Day 1' }).click();
  await expect(page.getByText('Enter a Nigerian phone number like 0803 123 4567.')).toBeVisible();
  await page.getByLabel('Phone number').fill(PHONE);
  await page.getByRole('button', { name: 'Save my result and start Day 1' }).click();
  await expect(page.getByText('Save this code. You need it to get back in on a new phone or after clearing your browser.')).toBeVisible();
  recoveryCode = (await page.locator('.code-box').textContent())!.trim();
  expect(recoveryCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  // Shown once: a reload no longer shows it.
  await page.reload();
  await expect(page.locator('.code-box')).toHaveCount(0);
  await page.getByRole('link', { name: 'Start Day 1' }).click();
  await expect(page.getByText('Day 1 of 14').first()).toBeVisible();
});

test('4. complete Day 1; the score persists after reload', async () => {
  const { lesson } = await (await page.request.get('api/lessons/1')).json();
  await page.getByRole('button', { name: 'Start the 10 questions' }).click();
  for (const [i, q] of (lesson.questions as { answer: string }[]).entries()) {
    // Answer the first question wrong, the rest right.
    const letter = i === 0 ? (q.answer === 'A' ? 'B' : 'A') : q.answer;
    await pick(page, letter);
    await expect(page.locator('.feedback')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Report a problem' })).toBeVisible();
    await page.getByRole('button', { name: i === 9 ? 'See my score' : 'Next question' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Day 1 done' })).toBeVisible();
  await expect(page.getByText('9 of 10', { exact: true })).toBeVisible();
  await page.goto('learn');
  await page.reload();
  await expect(page.getByText('Done, 9 of 10')).toBeVisible();
});

test('5. Day 4 unpaid: pay prompt, and no paid content in the response', async () => {
  const res = await page.request.get('api/lessons/4');
  const body = await res.text();
  expect(res.status()).toBe(403);
  expect(JSON.parse(body).error.code).toBe('NEEDS_PAYMENT');
  expect(body).not.toContain('d04-q');
  await page.goto('learn/day/4');
  await expect(page.getByText('Pay ₦300 to unlock Days 4 to 14.')).toBeVisible();
});

test('6. checkout in test mode, return, paid, Day 4 scheduled for the cohort', async () => {
  await page.goto('buy');
  await page.getByRole('button', { name: 'Pay ₦300' }).click();
  await expect(page.getByRole('heading', { name: 'Test payment' })).toBeVisible();
  await page.getByRole('button', { name: 'Pay successfully' }).click();
  await expect(page.getByText('Your payment is confirmed. Opening your lessons...')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`Your lessons start on ${START_LONG} at 6:00 pm.`)).toBeVisible();
  await page.getByRole('link', { name: 'Open my 14 days' }).click();
  await expect(page.getByText(`Opens ${START_SHORT}, 6:00 pm`)).toBeVisible();
});

test('7. offline answers queue and sync on reconnect', async () => {
  // Day 2 opens tomorrow evening for a new signup, so redo Day 1 offline.
  await page.goto('learn/day/1');
  await page.getByRole('button', { name: 'Practise Day 1 again' }).click();
  await page.context().setOffline(true);
  await expect(page.getByText('You are offline. Your answers are saved and will sync when you reconnect.')).toBeVisible();
  await pick(page, 'B');
  await expect(page.locator('.feedback')).toBeVisible();
  await expect(page.getByText(/saved on this phone/)).toBeVisible();
  await page.context().setOffline(false);
  await expect
    .poll(async () => {
      const { progress } = await (await page.request.get('api/lessons/1')).json();
      return Object.values(progress.maxAttempt as Record<string, number>).some((n) => n >= 2);
    }, { timeout: 15_000 })
    .toBe(true);
});

test('8. sign out, then recover with phone and code', async () => {
  await page.goto('account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/jamb-practice\/?$/);
  await page.goto('recover');
  await page.getByLabel('Phone number').fill(PHONE);
  await page.getByLabel('Recovery code').fill(recoveryCode.toLowerCase());
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Ada' })).toBeVisible();
  // Recovery issues a new code; the old one is used up.
  const fresh = (await page.locator('.code-box').textContent())!.trim();
  expect(fresh).not.toBe(recoveryCode);
  recoveryCode = fresh;
});

test('9. report a problem; it appears on the admin content page', async ({ browser }) => {
  await page.goto('learn/day/1');
  await page.getByRole('button', { name: 'Practise Day 1 again' }).click();
  await page.getByRole('button', { name: 'Report a problem' }).click();
  await expect(page.getByRole('heading', { name: 'What is wrong with this question?' })).toBeVisible();
  await page.getByLabel('There is a typo').check();
  await page.getByLabel('Tell us more (optional)').fill('Missing full stop');
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Thank you. A teacher will check it.')).toBeVisible();

  const admin = await adminPage(browser);
  await admin.goto('admin/content');
  await expect(admin.getByText('Day 1, d01-q01')).toBeVisible();
  await expect(admin.getByText(/Missing full stop/)).toBeVisible();
  // The funnel and gates reflect the test traffic (test payments excluded from gate 2).
  await admin.goto('admin');
  await expect(admin.getByRole('cell', { name: 'Signed up' })).toBeVisible();
  await admin.goto('admin/audit');
  await expect(admin.getByRole('cell', { name: 'cohort-save' })).toBeVisible();
  await admin.context().close();
});

test('10. delete the account; the session and data are gone', async () => {
  await page.goto('account');
  await page.getByLabel('Type DELETE to remove your account and details.').fill('DELETE');
  await page.getByRole('button', { name: 'Delete my data' }).click();
  await expect(page).toHaveURL(/deleted=1/);
  const me = await page.request.get('api/me');
  expect(me.status()).toBe(401);
  await page.goto('recover');
  await page.getByLabel('Phone number').fill(PHONE);
  await page.getByLabel('Recovery code').fill(recoveryCode);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('That phone number and recovery code do not match.', { exact: false })).toBeVisible();
});

test('admin routes are unreachable without login', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto('admin/orders');
  await expect(p).toHaveURL(/admin\/login$/);
  const res = await p.request.get('admin/export/orders');
  expect(res.status()).toBe(401);
  await ctx.close();
});
