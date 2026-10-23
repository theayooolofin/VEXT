# Architecture: vextglobal.com/jamb-practice

Status: built to BUILD_SPEC.md v1.0 milestones M1 to M5 plus the M7 tooling. M6 (referrals) is deliberately not built (spec 1.5). **Hosting is not yet decided** (see "Open decisions").

## What exists today (Phase 0 findings)

| Item | Finding |
| --- | --- |
| Main site | Static HTML, CSS and JS at the repo root. No framework, no package manager, no build step. |
| Hosting | Hostinger shared hosting. `.github/workflows/deploy.yml` tars the repo and extracts it into `~/domains/vextglobal.com/public_html` over SSH (port 65002) on every push to `main`. |
| Routing | Apache `.htaccess`: extensionless URLs map to `.html` files; trailing slashes are stripped. |
| Database, auth, server code | Not found. |
| Styling | Global CSS files at the root. This app does not load any of them. |
| Analytics, cookie banner | None found in the main site. This app adds none. |
| CI | Only the Hostinger deploy. |
| DNS/CDN | Not visible from the repo (owner to confirm; see open decisions). |

Consequence: the main site's host cannot run this app's server. The app is built as a separate Next.js app in `apps/jamb-practice/`, and **the Hostinger deploy now excludes `apps/`** so source code and lesson files are never uploaded to `public_html`.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript strict | Server-rendered pages and API route handlers in one app. Note: Next 16 renamed middleware to `proxy.ts` and made request APIs async-only. |
| Mount | `basePath: /jamb-practice`, `output: 'standalone'` | Runs on any Node host; every URL, cookie and the service worker live under `/jamb-practice/`. |
| Database | PostgreSQL via Drizzle ORM (`postgres` driver). Local dev and tests use **PGlite** (Postgres compiled to WASM) | No Docker or local Postgres needed; same SQL and migrations everywhere. |
| Validation | zod 4 on env, request bodies, settings and content files | |
| Payments | Paystack behind `PaymentProvider` (`src/lib/payments/`) plus a `fake` provider for tests | |
| Push | `web-push` 3.6.7 with VAPID | |
| Admin password | bcryptjs (pure JS, no native build) | |
| Tests | Vitest 5 (unit + integration on PGlite), Playwright 1.64 (mobile 360x740) | |
| Styling | One hand-written CSS file with the spec 9.3 tokens; system fonts only | |

No third-party scripts, fonts, trackers or paid services are used.

## Layout

```
apps/jamb-practice/
  app/                      pages and route handlers (paths are relative to /jamb-practice)
    api/...                 JSON API (spec 5.2)
    admin/...               admin pages; admin/actions/[action] and admin/export/[kind] handle forms and CSVs
  proxy.ts                  anonymous id + first-touch cookies, nonce CSP, security headers
  content/jamb-english/     real content (empty until the teacher delivers) and _fixtures/ (tests only)
  src/db/                   schema.ts, migrations/, seedData.ts
  src/lib/                  business logic (pure modules are unit-tested; *Repo/actions touch the DB)
  src/components/           React components; client components are marked 'use client'
  src/client/               browser-only helpers: API calls, event batching, offline queue
  public/                   sw.js, icons, og.png (no lesson content, ever)
  scripts/                  content tools, db migrate/seed, secrets, e2e server, perf, bundle and secret checks
  tests/                    unit/, integration/, e2e/
```

## Key flows (where to look)

- Unlock schedule: `src/lib/unlock.ts` (pure; Appendix B is in `tests/unit/unlock.test.ts`). Lagos is a fixed UTC+1 offset, cross-checked against `Intl` in tests.
- Lesson gate: `src/lib/lessons.ts#decideLesson` is the only path to lesson content. `GET /api/lessons/[n]` returns 403 with `NEEDS_PAYMENT`, `NOT_YET` (+`unlocksAt`), `CONTENT_NOT_READY` or `EXPIRED`, and 401 `NOT_SIGNED_IN`.
- Answers are re-marked on the server from its own copy; first-attempt scoring in `completeLesson`.
- Payment: `src/lib/checkout.ts` creates the order (price from settings, cohort from the open enrolment window); `src/lib/payments/settle.ts` is the single settle routine used by the return page, the webhook, housekeeping and the admin re-verify button. It verifies with the provider first, then locks the order row (`SELECT ... FOR UPDATE`) and grants at most once. A partial unique index also allows only one live entitlement per student and product.
- Content approval: `src/lib/contentStore.ts`. A lesson's hash is SHA-256 of its canonical JSON (sorted keys), so line endings and formatting do not matter but any content edit withdraws approval.

## Paystack: what was checked

Paystack's documentation site blocks automated fetching (HTTP 403), so the integration was checked against Paystack's official OpenAPI spec (`github.com/PaystackOSS/openapi`, `dist/paystack.yaml`) and official code samples (`PaystackOSS/doc-code-snippets`):

- `POST https://api.paystack.co/transaction/initialize` with `email`, `amount` (kobo), `currency`, `reference` (alphanumeric plus `-.=`), `callback_url`, `metadata`, `channels`; returns `data.authorization_url`.
- `GET /transaction/verify/{reference}` returns `data.status`, `amount`, `currency`, `reference`, `id`, `paid_at`.
- Webhook signature: header `x-paystack-signature` = HMAC-SHA512 (hex) of the raw body using the secret key.

Differences from the spec, and choices made:

1. **Paystack reports a transaction the customer has not finished as `abandoned`.** That is not final, so `abandoned` is treated as still pending; housekeeping marks our order `abandoned` only after 24 hours.
2. Paystack webhooks carry no event id. The dedupe key is `event:transaction_id:reference`.
3. Webhooks for references we do not know (for example other products on the same Paystack account) are stored and acknowledged with 200, and change nothing.
4. `reversed` is mapped to failed.
5. **Not verified, owner to confirm with Paystack:** whether a placeholder email is acceptable (spec question 11). Default: checkout asks students without an email for one. Setting `PAYMENT_PLACEHOLDER_EMAIL_DOMAIN` switches to `student-<id>@<domain>` instead.
6. Paystack's webhook source IP list was not checked; the signature check is the control.

## Decisions that differ from the spec

| Spec | Built | Why |
| --- | --- | --- |
| Admin API at `/api/admin/*` | `/admin/actions/[action]` and `/admin/export/[kind]` | The admin cookie has `Path=/jamb-practice/admin` (spec 5.3), so browsers would not send it to `/api/admin`. |
| Diagnostic scored in the browser | Scored on the server; the browser never receives the diagnostic answers | Keeps answers and explanations behind signup (spec 7.3) and makes the stored score trustworthy. One small request at the end. |
| "Report a problem" on every question | On every lesson question; not on the anonymous diagnostic or hero | The report API requires a session (spec 5.2). |
| Signup rate limit | 30 per hour per IP (recovery stays 5 per phone and per IP) | Many Nigerian mobile users share carrier IPs (CGNAT). Watch the recovery limit for the same reason. |
| `ADMIN_PASSWORD_HASH` as a raw bcrypt hash | Raw or base64url-encoded; the helper prints base64url | Next's `.env` loader expands `$` sequences and corrupts raw bcrypt hashes. |
| PWA `start_url` `/jamb-practice/?source=pwa` | Same, with `skipTrailingSlashRedirect` | Next would otherwise redirect `/jamb-practice/` out of the service worker scope. |
| next/link | Plain `<a>` on student pages | Saves the client router chunk; needed to meet the 150 KB landing budget. |
| Paid day "unavailable" alert | Shown on the admin overview whenever a day has opened for any active cohort but cannot be served | |

Price overshoot: two checkouts racing at the exact founding cap can both get the founding price. Accepted (spec 7.6).

## Security notes

- Cookies: `jp_anon`, `jp_attr` (signed), `jp_session` (HttpOnly, random token, only its keyed hash stored), `jp_admin` (HttpOnly, SameSite=Strict, signed, 2 hours). All `Secure`, all path-scoped.
- CSRF: `Origin` check on every state-changing request plus a per-session token (`x-csrf-token`, from a meta tag) for signed-in POSTs; admin forms carry a token tied to the admin cookie.
- CSP: nonce-based `script-src` with `strict-dynamic`, `frame-ancestors 'none'`, `connect-src 'self'`. Inline styles are allowed (React style attributes); scripts are not.
- Logs are structured JSON with no phone numbers, emails, tokens or webhook bodies. Stored webhook and verify payloads are redacted to transaction fields only.
- Paid lessons are only in `content/` (server files) and only served by the lesson API. `npm run check:bundle` searches the client build and `public/` for every paid-day id, rule and explanation.
- `npm run secret-scan` checks tracked files; `.env*` files are git-ignored.

## Data retention (flag for lawyer review)

Account deletion nulls name, phone, email, anon id and attribution, deletes sessions, recovery codes and push subscriptions, and blanks free-text in reports and support requests. **Orders are kept** (reference, amount, dates) as financial records, and anonymous lesson progress is kept for aggregate statistics. Events older than 12 months are deleted by housekeeping. A lawyer should confirm the order-retention rule and period.

## Performance (measured 23 Oct 2026, `npm run perf`)

Production build, `next start` with gzip, Chromium at 360x740, simulated Slow 4G (150 ms RTT, 1.6 Mbps down) and 4x CPU slowdown:

| Page | Transfer | LCP | CLS | Budget |
| --- | --- | --- | --- | --- |
| Landing, cold | 149.5 KB | 0.9 s | 0 | 150 KB, LCP < 2.5 s, CLS < 0.1 |
| Lesson, after first load | 14.3 KB | 0.7 s | 0 | 100 KB |

The landing page is **just under** budget: about 116 KB of it is the React and Next.js runtime. A CDN with Brotli (for example Cloudflare in front) would give more headroom. Any new client-side code on the landing page must be weighed against this. Lighthouse CI is not used; `npm run perf` fails the CI build over budget instead.

## Open decisions (need the owner)

1. **Hosting.** Hostinger shared hosting cannot run this Node server. Options:
   - **Hostinger Node.js app** if your plan includes it (Business/Cloud plans list "Node.js web apps"): keeps one provider. Check whether it can serve under `vextglobal.com/jamb-practice` or only a subdomain.
   - **Vercel** (Hobby is free but for non-commercial use only; Pro is about $20/month) or **Render/Railway/Fly** (small paid plans; Render's free tier sleeps, which delays webhooks).
   Then mount it: if the DNS/CDN (for example Cloudflare) can route `/jamb-practice/*` to the app, keep the path. Otherwise use `practice.vextglobal.com` (the app still serves under `/jamb-practice`, so the links become `practice.vextglobal.com/jamb-practice`) and add a redirect from `vextglobal.com/jamb-practice` in the main `.htaccess`.
2. **Database:** managed Postgres. Neon's free tier (0.5 GB, scales to zero with a short cold start) is enough for the pilot; Supabase's free tier pauses after a week of inactivity. Daily backups and a tested restore are required before launch (RUNBOOK 13).
3. **Cron:** `.github/workflows/jamb-practice-cron.yml` calls the endpoints once `JAMB_PRACTICE_URL` (repository variable) and `JAMB_PRACTICE_CRON_SECRET` (secret) are set. Use the host's scheduler instead if it has one.
4. **Main-site robots and sitemap:** the app serves `/jamb-practice/sitemap.xml`. Add `Sitemap: https://vextglobal.com/jamb-practice/sitemap.xml` and `Disallow: /jamb-practice/admin` to the main site's `robots.txt` (there is none today).
