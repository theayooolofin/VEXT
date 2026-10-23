# UTME English Booster (vextglobal.com/jamb-practice)

A mobile-first, low-data 14-day UTME Use of English course: a free diagnostic, free Days 1 to 3, and a ₦300 pack for Days 4 to 14, paid through Paystack.

- Developers: start with [CLAUDE.md](CLAUDE.md) (commands and rules) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Owner: [docs/RUNBOOK.md](docs/RUNBOOK.md).
- Owner and teacher: [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md).

Quick start:

```
npm ci
cp .env.example .env.local   # then fill the empty secrets: npm run make:secret
npm run dev                  # http://localhost:3000/jamb-practice
```

Local development uses fake test lessons and a fake payment page; no real money or content is involved.
