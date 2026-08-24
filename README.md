# SwiftJob — Global Workforce Platform

> **One-line:** Careers portal + applicant pipeline + admin + email automation. TypeScript monorepo (Express + React 19 + Cloudflare Workers + R2).

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Stack](https://img.shields.io/badge/stack-TypeScript%20%E2%80%A2%20React%2019%20%E2%80%A2%20Workers-blue) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## What problem does this solve?

Hiring globally means **collecting structured applications, storing resumes safely, keeping HR and candidates in sync, and never losing an application**. Spreadsheets + email break at 50 applicants. SwiftJob replaces that with a typed pipeline.

**Who is it for?** A 10–500 person company hiring remote professionals across departments (14 job families in this instance) that needs a self-hosted, auditable alternative to Lever/Greenhouse.

**What can it do today?**
- 14 jobs with filtering, search, pagination (`lib/db.jobs`, `artifacts/api-server`)
- Application form: 19 required fields + resume upload (PDF/DOC/DOCX ≤10MB) → R2 presigned URL
- Admin dashboard: paginated table, search/filter, status dropdown (New → Reviewing → Shortlisted → Rejected/Hired), detail modal + resume download, stats overview
- Email: applicant confirmation + HR notification + status-change emails via Resend
- Auth: JWT admin, rate-limit, Helmet, CORS, Zod validation
- Type safety: OpenAPI 3.1 → Orval → Zod → React Query (end-to-end)

---

## Screenshot / Demo

> **Add after deployment — 1–3 images tell the story before any install.**
> Expected captures:
> - `assets/screenshots/01-careers.png` — job listing grid with filters
> - `assets/screenshots/02-apply.png` — 19-field form + resume upload
> - `assets/screenshots/03-admin.png` — admin table + status dropdown

**Live demo:** `https://swiftjob.payservice.top` (Workers) + `https://swiftjob-systems...` (Vercel) — link here after deploy. Until then: `pnpm dev` screenshots.

---

## Architecture — real code

```
                         SwiftJob Monorepo
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
     lib/*                 artifacts/*           workers-api
        │                      │                 (Hono on Cloudflare)
        │              ┌───────┴────────┐              │
        │         api-server (Express)  swiftjob-systems│
        │              │           (React 19 + Vite)────┘
        │         ┌────┴────┐               │
   api-spec    services  repositories       TanStack Query
 (openapi.yaml)  │          │            (api-client-react)
        │     email  application/job
   Orval │    storage  Drizzle ORM
        ↓      │          │
     api-zod ←┘      PostgreSQL (Neon/Supabase)
        │                │
     api-client-react ───┘
              │
           R2 Bucket (resumes) + Resend (emails)
```

**Code truth:**
- `lib/api-spec/openapi.yaml` — single source of truth (title `Api`, path `/api/healthz`)
- `lib/api-spec/orval.config.ts` → generates `lib/api-zod` (Zod) + `lib/api-client-react` (React Query hooks, `custom-fetch.ts`)
- `lib/db/src/schema/` — `jobs.ts` (pgTable `jobs`, 20+ columns, arrays for responsibilities/skills/benefits) + `applications.ts` (pgEnum `application_status`, 19 fields, `reference_code` unique, `resume_path`)
- `artifacts/api-server/src/` — `app.ts` (Express 5), `services/` (applicationService, jobService, emailService, storageService), `routes/` (jobs, applications, admin, auth, health), `middleware/` (auth, upload), `repositories/` (Drizzle)
- `workers-api/src/` — Hono + `wrangler.toml` (`R2_BUCKET=swiftjobsystems`, `FRONTEND_URL=https://swiftjob.payservice.top`), `jose` JWT, `resend`
- `artifacts/swiftjob-systems/src/` — Vite 7 + Wouter + Zustand? actually TanStack Query + `lib/db` types, shadcn/Radix, `xlsx` for export
- `scripts/`, `.github/workflows/ci-cd.yml` — typecheck → build → deploy-worker (Node 24, pnpm 11)

---

## Key capabilities

| Flow | How it works |
|------|--------------|
| **Apply** | Frontend validates 19 fields (Zod, `hookform/resolvers`) → presigned R2 upload → `POST /api/applications` → Drizzle insert + reference_code → Resend: applicant + HR emails |
| **Admin** | JWT login (`middleware/auth.ts`) → `GET /api/admin/applications` (paginated, filterable) → status dropdown → `PATCH /api/admin/applications/:id/status` → Resend status email |
| **Jobs** | `GET /api/jobs` (isActive filter, slug unique) → React Query cache → `wouter` routes |
| **Storage** | `storageService.ts` → Cloudflare R2 (`R2_BUCKET` binding) → presigned URL for download in admin modal |

---

## Tech Stack

| Layer | Tech (exact) |
|-------|--------------|
| Language | TypeScript 5.9 strict, composite `tsconfig.base.json` |
| Package | pnpm 11 workspace (`pnpm-workspace.yaml`, `minimumReleaseAge:1440`, `catalog:`) |
| DB | PostgreSQL (Neon) + Drizzle ORM 0.38, `drizzle-zod` |
| API | Express 5 (artifacts) + Hono 4.6 (workers-api), Zod 3.23/4, `jose` JWT |
| Frontend | React 19, Vite 7, Tailwind 4, shadcn/Radix 20+, Wouter 3.3, TanStack Query, React Hook Form 7.55, Recharts 2.15 |
| Infra | Cloudflare Workers (wrangler 3.80), R2, Resend 4.0, Neon serverless 0.9 |
| CI | GitHub Actions `ci-cd.yml` (typecheck libs → typecheck worker → typecheck frontend → build frontend → deploy worker on `main`) |
| Node | 24 (CI), 22 recommended locally |

---

## How to run

```bash
git clone https://github.com/conquestaisiri/swiftjob-systems.git
cd swiftjob-systems
pnpm install --frozen-lockfile

# env — create per artifact (never commit)
cp artifacts/api-server/.env.example artifacts/api-server/.env
cp workers-api/.dev.vars.example workers-api/.dev.vars
# fill: DATABASE_URL (Neon), RESEND_API_KEY, ADMIN_PASSWORD, R2 credentials, FRONTEND_URL

# dev
pnpm run typecheck:libs
pnpm --filter @workspace/swiftjob-systems dev   # http://localhost:5173
pnpm --filter @workspace/swiftjob-workers-api dev  # wrangler dev

# build
pnpm run build   # frontend → artifacts/swiftjob-systems/dist
```

**Env vars:** `DATABASE_URL`, `RESEND_API_KEY`, `ADMIN_PASSWORD`, `R2_BUCKET`, `JWT_SECRET`, `FRONTEND_URL` — see `artifacts/api-server/.env.example` and `workers-api/.dev.vars.example`.

---

## Project structure

```
swiftjob-systems/
├── lib/
│   ├── api-spec/        # openapi.yaml + orval.config.ts (source of truth)
│   ├── api-zod/         # generated Zod schemas
│   ├── api-client-react/# generated React Query hooks
│   └── db/              # Drizzle schema (jobs, applications, auth)
├── artifacts/
│   ├── api-server/      # Express API (app.ts, routes/, services/, repositories/, middleware/)
│   └── swiftjob-systems/# React 19 frontend (Vite, wouter, shadcn)
├── workers-api/         # Hono on Cloudflare Workers (R2, Resend, jose)
├── scripts/             # utility
└── .github/workflows/ci-cd.yml
```

---

## Engineering decisions

- **Orval + Zod + React Query** over manual fetch: OpenAPI is the contract, everything else generates — prevents drift between backend and frontend types.
- **Drizzle over Prisma:** lighter, SQL-close, `drizzle-zod` reuses schema for validation.
- **Two API runtimes:** Express for local/full Node, Hono for edge (Workers) — shared `lib/db` and schemas, deploy target chooses runtime. `wrangler.toml` pins `compatibility_date=2024-08-01` + `nodejs_compat`.
- **R2 presigned URLs** over direct upload: resumes never touch API disk, admin download is presigned (expiry handled in `storageService`).
- **pnpm `minimumReleaseAge:1440`** — supply-chain defense: delays newly published packages by 1 day.

---

## Limitations

- No live demo link yet (infra ready, needs deploy).
- No unit tests for `applicationService`/`jobService` — add `vitest` next.
- 14 jobs are seed data, not CMS — admin cannot create jobs via UI (only via DB).
- Email relies on Resend; no fallback.
- `attached_assets/` images are committed (consider R2 or LFS if >50MB).

## Roadmap

- [ ] Deploy: Workers API → `swiftjob.payservice.top`, frontend → Vercel (`render.yaml`/`koyeb.yaml` already present)
- [ ] Screenshots + 30s GIF (apply → admin → email)
- [ ] Tests: `applicationService` (Zod validation + Drizzle), resume upload edge (10MB, MIME)
- [ ] Admin job CRUD (create/edit jobs)
- [ ] Rate-limit per IP on `POST /applications` (currently global)

## Security

- `.env` + `.dev.vars` gitignored (verified). JWT via `jose`, Helmet, CORS, rate-limit.
- Report the revoked PAT `ghp_wV3MBD...` — rotate if you reused it elsewhere.

## Status

**Active** — main showcase. CI green on `main`.

## License

MIT — see `LICENSE`.