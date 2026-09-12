# Baseline architecture

Baseline commit: `bc44d3820010a919436ff9b9f25a5e00a6ad5e9a` on main. Initial working tree was clean. Inspection date: 2026-09-11.

The active product is a React 19/Vite 7/Wouter SPA in `artifacts/swiftjob-systems`. Cloudflare Pages serves its compiled assets and a Pages Function forwards `/api/*` to the Hono Worker in `workers-api`. The Worker uses Drizzle/Neon HTTP for PostgreSQL, R2 for private CV files, and Resend for transactional and administrator-initiated email. Candidate authentication combines one-use email links, database-backed sessions and optional PBKDF2 passwords. Administrators use an environment-configured email/password and a signed JWT. The former combined MSI/B2 installer path is retired; the standard reviewed checker remains.

The supported product roles are visitor, candidate and internal administrator. An `hr` JWT role is accepted by the admin middleware, but no separate HR provisioning interface exists. No independent employer account, employer billing, employer dashboard or employer-owned vacancy model was found. Organizations contact SwiftJob; internal staff manage hiring. Employer features must not be invented as part of this repair.

Active modules: public jobs/applications/contact, assessments, technical checks, candidate portal, referrals, campaign landing pages, admin jobs/applications/contacts/referrals/campaigns/mail/settings/activity and device/event footprints. Twelve SQL migrations define the current schema. Some services also perform schema repair at request time; this duplicates migration responsibility.

Retired Express code remains in `artifacts/api-server`, together with earlier database/schema/generated client packages. Its presence does not establish an active Render deployment. There is no configured queue, cron trigger or durable email outbox in the active Worker configuration. Application email uses `waitUntil`; several other background writes use untracked promises. Logging is primarily console output plus selective database activity rows. No complete error-monitoring integration was verified.

Evidence: `evidence/repository-inventory.json`, `evidence/active-api-routes.json`, `evidence/database-baseline.json`, `evidence/provider-access.json`. Provider checks are read-only; no production state changes were made during baseline.
