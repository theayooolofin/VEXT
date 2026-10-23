# Runbook (for the owner)

Short steps for everyday jobs. The admin page is at `https://vextglobal.com/jamb-practice/admin` (or the address chosen at launch). Every admin action is written to the audit log.

## 0. First launch on Hostinger (one time)

1. **Database:** create a free Postgres database at neon.tech (region: Europe, nearest to Nigeria). Copy its connection string (`postgres://...`). Turn on backups (RUNBOOK 13).
2. **Paystack:** in the Paystack dashboard, add a new business for UTME English (top-left business menu → Add new business) and complete its compliance form as an education business. When it is approved, copy its live keys.
3. **Subdomain:** hPanel → Domains → create `practice.vextglobal.com`.
4. **Node.js app:** hPanel → Websites → Add website → Node.js app, on `practice.vextglobal.com`. Connect the GitHub repository, branch `main`. If it asks for a root or app folder, enter `apps/jamb-practice`; if it has no such option, upload a zip of the `apps/jamb-practice` folder instead (without `node_modules`, `.next`, `.data` and `.env.local`). Node 22 or newer. Build command `npm run build`, start command `npm start`.
5. **Environment variables** (in the Node.js app settings), using the names in `.env.example`:
   - `APP_BASE_URL=https://practice.vextglobal.com`, `BASE_PATH=/jamb-practice`, `NODE_ENV=production`
   - `DATABASE_URL` = the Neon string
   - `SESSION_SECRET`, `IP_HASH_SALT`, `CRON_SECRET`: three separate outputs of `npm run make:secret`
   - `ADMIN_PASSWORD_HASH` = output of `npm run make:admin-hash -- "your long password"`
   - `PAYMENT_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` from the new Paystack business
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` from `npm run make:vapid`; `VAPID_SUBJECT=mailto:<support email>`
   - `SUPPORT_WHATSAPP_E164`, `SUPPORT_EMAIL`, `PRODUCT_NAME`, `LEGAL_BUSINESS_NAME`, `PRIVACY_CONTACT_EMAIL`
   - `ALLOW_UNREVIEWED_CONTENT=false`, `CONTENT_DIR=content/jamb-english`
6. **Paystack webhook** (new business only): Settings → API Keys & Webhooks → Live Webhook URL `https://practice.vextglobal.com/jamb-practice/api/webhooks/paystack`.
7. **Scheduled jobs:** GitHub → repository Settings → Secrets and variables → Actions: variable `JAMB_PRACTICE_URL=https://practice.vextglobal.com/jamb-practice`, secret `JAMB_PRACTICE_CRON_SECRET` = the same `CRON_SECRET`.
8. Deploy, then open `https://practice.vextglobal.com/jamb-practice/api/health` (must say `"database":"ok"`), then `/jamb-practice/admin`.
9. Content approval (CONTENT_GUIDE), then one real ₦300 payment and a refund (RUNBOOK 4) before telling anyone the link.

Merging to `main` also deploys the main site, which now redirects `vextglobal.com/jamb-practice` to the subdomain.

## 1. Deploy and roll back

- **Deploy:** merge the change into `main` on GitHub. CI must be green first (all tests, content checks, size budget). Hosting is not chosen yet; this section will name the host's "redeploy" button once it is (see ARCHITECTURE "Open decisions").
- Database changes run with `npm run db:migrate` during deploy. Never edit an old migration file.
- **Roll back:** redeploy the previous version from the host's dashboard. Database changes are additive, so the older version keeps working.

## 2. Add or fix a lesson

Follow docs/CONTENT_GUIDE.md: edit or import → `npm run content:validate` → teacher approves with `npm run content:approve` → commit → deploy. An edited lesson is hidden until it is approved again.

## 3. Create a new cohort and open enrolment

Admin → **Cohorts** → New cohort. Set the name, the start date (Day 4 opens that evening), and when enrolment opens and closes (Lagos time). Tick **Active**. Buyers join the cohort whose enrolment is open when they pay. If no enrolment is open, the buy page says enrolment is closed and links to WhatsApp.

## 4. Handle a refund request

1. Requests arrive on WhatsApp or in Admin → **Support** (type "refund").
2. Check it is within the refund window (Settings → refund window, counted from when Day 4 opened for their cohort).
3. Refund the payment in the **Paystack dashboard**.
4. Admin → **Orders** → find the reference → **Mark refunded**. This removes their access to Days 4 to 14.
5. Mark the support request **Done**.

## 5. "I paid but cannot open Day 4"

1. Ask for the payment reference (starts with `JP-`, also on their Paystack receipt) or their phone number.
2. Admin → **Students** → search → open the student. Look at Orders.
   - **pending/failed/abandoned:** click **Re-verify** on the Orders page. If Paystack says it was paid, access is granted at once.
   - **paid:** they have access. If Day 4 has not opened yet, it opens on their cohort's start date at the unlock time; tell them the date shown on their dashboard. If they are on a new phone, they need to sign in with their recovery code (see 7).
   - **needs_review:** the amount or currency did not match. Check the transaction in the Paystack dashboard. If it is right, click **Grant after checking Paystack**.
   - **duplicate:** they paid twice. They already have access; refund the extra payment (see 4).
3. If nothing matches, see 6.

## 6. Grant access by hand

Admin → Students → open the student → **Grant access**, choose the cohort and write why. Use it for: a confirmed payment that cannot be matched, a school or partner deal, or a goodwill fix. Hand grants never count as sales in the gates.

## 7. A student lost their recovery code

1. Make sure it is really them: the WhatsApp number writing to you should match the phone on their account.
2. Admin → Students → open the student → **Issue a new recovery code**. The code is shown once.
3. Send it to them on WhatsApp. Their old code stops working.

## 8. Delete a student's data on request

Students can do it themselves on their account page. For a request by WhatsApp: Admin → Students → open the student → type DELETE → **Delete data**. Name, phone, email and sign-in details are removed; payment records stay.

## 9. Rotate keys and secrets

Change the value in the host's environment settings, then redeploy.

- **Paystack:** create new keys in the Paystack dashboard → update `PAYSTACK_SECRET_KEY` (and `PAYSTACK_PUBLIC_KEY`) → redeploy → revoke the old key. The webhook URL stays `.../jamb-practice/api/webhooks/paystack`.
- **SESSION_SECRET:** `npm run make:secret`. Changing it signs everyone out (they sign back in with phone and recovery code) and invalidates all recovery codes, so only rotate it if it leaked, and be ready to issue codes.
- **CRON_SECRET:** `npm run make:secret`; update it in the app and in the GitHub secret `JAMB_PRACTICE_CRON_SECRET`.
- **Admin password:** `npm run make:admin-hash -- "new long password"` → put the output in `ADMIN_PASSWORD_HASH`.
- **VAPID (push) keys:** `npm run make:vapid`. Changing them breaks existing reminder subscriptions; students must turn reminders on again. Avoid unless leaked.

## 10. Change the price, founding cap or unlock time

Admin → **Settings**. Prices are in naira. The page shows the price buyers see right now and how many founding places are left. The unlock time moves every future unlock and reminder. Show the founding counter only if you want the real number of places taken displayed.

## 11. Reading the gate panels (Admin → Overview)

| Gate | What it shows | Status |
| --- | --- | --- |
| 1 Problem check | Interview counts you type into Settings | passed at 10 of 15 confirming |
| 2 Will they pay | Real paid orders in the founding cohort's enrolment window (test payments and hand grants excluded) | on track during the window; passed at the target; failed if the window ends below it |
| 3 Does it work | For each cohort: share of buyers active on Day 7, share finishing Day 14, refund rate | waiting until Day 14 opens |
| 4 Can it grow | Share of buyers with an add-on or rewarded referral, and channels at or under the cost target with enough orders | add-ons and referrals are not built yet, so this stays "on track" |

Enter ad spend in Admin → **Spend** using the same channel name as the `utm_source` in your links, for example `https://vextglobal.com/jamb-practice/?utm_source=tiktok&utm_campaign=nov`.

## 12. Manual WhatsApp nudges

Admin → **Nudges** lists paid students who skipped their last two days. Click **Open WhatsApp** (the message is pre-filled from Settings), send it, then **Mark nudged**.

## 13. Backups and restore

Turn on daily backups in your database provider before launch, then **test a restore once**: restore into a new database, point a preview deployment's `DATABASE_URL` at it, open `/jamb-practice/api/health` (it must say `"database":"ok"`) and check the admin overview shows your students. Write down the date and steps here.

## 14. Who to contact and where logs are

- Payments: Paystack support and dashboard (transactions, refunds, webhook delivery logs).
- App errors: the host's log viewer. Lines are JSON; search for `"level":"error"`. They never contain phone numbers or emails; orders appear by reference.
- Uptime: point a free monitor at `https://<site>/jamb-practice/api/health` (expect HTTP 200).
- Scheduled jobs: GitHub → Actions → "jamb-practice scheduled jobs" shows every run.
- Developer: (fill in).
