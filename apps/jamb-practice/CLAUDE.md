# Project rules for Claude Code (vextglobal.com/jamb-practice)

Read BUILD_SPEC.md before any task. It is the source of truth. Update docs/ARCHITECTURE.md when you make a decision.

This app lives in `apps/jamb-practice/`. The rest of the repository is the static vextglobal.com site, deployed to Hostinger by `.github/workflows/deploy.yml`, which excludes `apps/`. Do not change the main site.

## Commands (run in apps/jamb-practice)

- Install: `npm ci`
- Dev server: `cp .env.example .env.local` (fill secrets with `npm run make:secret`), then `npm run dev` → http://localhost:3000/jamb-practice. Uses PGlite (`DATABASE_URL=pglite:.data/dev`), migrated and seeded on first connect.
- Build: `npm run build` (production env checks apply). Test build: `E2E=1 npm run build`
- Unit and integration tests: `npm test` (Vitest, in-memory PGlite)
- End-to-end: `npm run test:e2e` (after an `E2E=1` build; starts its own server on :3100 with the fake payment provider)
- Lint: `npm run lint` · Typecheck: `npm run typecheck` · Format: `npm run format`
- Content: `npm run content:validate [-- --dir <path>] [--strict]`, `npm run content:approve -- --day N --reviewer "Name"`, `npm run content:import -- lessons.csv rules.csv`, `npm run content:fixtures` (regenerates test fixtures)
- Performance budgets: `npm run perf` · Paid content leak check: `npm run check:bundle` · Secret scan: `npm run secret-scan`
- Database: `npm run db:generate` (after schema changes), `npm run db:migrate`, `npm run db:seed`
- Secrets: `npm run make:secret`, `npm run make:vapid`, `npm run make:admin-hash -- "password"`
- Images: `npm run make:images` (Python + Pillow; outputs are committed)

## Rules

- Mount path is /jamb-practice. Never change routes, styles or behaviour of the rest of vextglobal.com.
- Money is integer kobo. Time zone is Africa/Lagos. Store UTC.
- The server decides who has paid. Never trust the browser or a client-supplied amount. All payment state changes go through `src/lib/payments/settle.ts` or `src/lib/adminActions.ts`.
- Paid lesson content must never be in public files or the client bundle. Lesson JSON is served only by `GET /api/lessons/[n]` after `decideLesson`.
- Next.js 16 differs from older versions: read `node_modules/next/dist/docs/` before using an API you are unsure of (`proxy.ts` not middleware; async `params`, `cookies()`).
- Never invent facts about the payment provider's API. Read the current official docs (Paystack's site blocks bots; use github.com/PaystackOSS/openapi) and say what you found.
- Never write real lesson content unless asked. Use fixtures.
- Never add a paid service, heavy dependency, tracker, or third-party script without asking. The landing page is at its 150 KB budget.
- Never put secrets in the repository or in logs. Never log phone numbers, emails, tokens, or full webhook bodies.
- No score promises, no "guaranteed", no JAMB logo. Keep copy as in section 9.6.
- Small commits. Tests with every feature. Report what you changed, what you tested, and what you chose differently from the spec.
- If the spec is silent or unclear, ask the owner before building.
