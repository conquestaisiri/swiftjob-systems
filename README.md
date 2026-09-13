# SwiftJob

Job board + referral recruiting platform. Public careers site, candidate portal,
private referral briefings, and a full admin panel.

## Architecture (live)

```
Browser SPA (React/Vite)  artifacts/swiftjob-systems
        │  same-origin /api/* (VITE_API_URL empty by default)
        ▼
Cloudflare Pages proxy     functions/api/[[path]].js   → forwards to the Worker
        ▼
Hono Worker (API)          workers-api                 → deploy: wrangler
        ├─ Neon Postgres   drizzle-orm (+ migrations/)
        ├─ Cloudflare R2   resume storage
        └─ Resend          transactional email
```

The legacy Express backend in `artifacts/api-server` is **retired** — it is not
deployed, not proxied, and only kept for reference.

## Development

```bash
pnpm install

# 1) API on :8787
cd workers-api && pnpm dev            # wrangler dev (needs .dev.vars: DATABASE_URL, etc.)

# 2) SPA (separate shell)
pnpm dev                              # vite on :5173, proxies /api → :8787
```

## Database

Migrations live in `workers-api/migrations/` and are applied manually with
`node workers-api/migrate.mjs <file>` (no applied-version tracking yet — each
file is idempotent except `001`, whose `CREATE TYPE` assumes a fresh DB).
The Worker performs a read-only schema guard once per isolate and fails clearly
when required migrations are missing; it never changes schema during a request.
Migrations are the only schema-write contract and must be applied before routing
traffic to a new deployment.

## Deploy (CI)

`.github/workflows/ci-cd.yml`

- Pages build: `artifacts/swiftjob-systems` (`pnpm build`)
- Worker deploy: `cd workers-api && wrangler deploy` with secrets:
  `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `HR_EMAIL`, `JWT_SECRET`,
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Optional: `SUPPORT_EMAIL`,
  `TURNSTILE_SECRET_KEY` (captcha stays off while unset).

## Admin & public surfaces

- Public: `/` landing · `/careers` · `/careers/:slug` apply · `/assessment` ·
  `/campaign/:slug` · `/referral/:code` private briefing · `/login` candidate magic-link
- Candidate portal: `/candidate/applications` (status, resume, private room),
  `/candidate/profile` (editable candidate profile), and `/candidate/referrals`
  (account-owned links with role-based $40–$100 rewards and pending/paid tracking)
- Admin: `/admin` — Overview, Applications (+ Skills Check tab), Jobs,
  Referrals (send/content editor), Mail, Contacts, Campaigns, Activity, Settings
