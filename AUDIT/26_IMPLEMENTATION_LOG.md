# Implementation log

## Batch A — verified candidate ownership and JSON/session boundaries

Status: IMPLEMENTED 2026-09-11; isolated regression and live boundary checks pass.

Objective: prevent unauthenticated candidate password creation/overwrite, make issued password sessions usable, revoke sessions on sign-out, and restore valid JSON mutations.

Findings: AUTH-01, AUTH-02, AUTH-03, API-01. Baseline: `evidence/workflow-baseline.json` proves public password overwrite (200), password session rejection (401), wrong cookie name and valid contact rejection (400). Frontend sign-out only clears localStorage (source finding).

Files changed: `workers-api/src/index.ts` (parseJson single boundary; register now behind candidateAuth deriving email from session + revoke-all + reissue; password login issues the shared single-signed session via setCandidateCookie; logout revokes and 503s on revocation failure; magic-link/admin-login/admin-mail-send and all tolerant body routes go through parseJson); `workers-api/src/services/auth.ts` (HS256 pin, strict role/email/sessionToken/exp claims, session-email binding); `ApplicationSuccess.tsx` (public password form removed, sign-in guidance); `CandidateApplications.tsx` (server logout + error handling); `CandidatePasswordForm.tsx` (new, authenticated in-portal password set/change); `CandidateLogin.tsx` (copy + turnstile null-safe).

Risk: tightening password registration changes the post-application password flow. Keep email-link sign-in available; explain verification on the success page; allow setting/resetting password only after sign-in. Existing password hashes must remain readable.

Expected behavior: anonymous/cross-account registration denied without writes; verified owner can set password; password and email-link sessions share cookie/token shape; logout revokes server session; valid JSON accepted and invalid bodies return 400.

Required checks:
- VERIFIED: `AUDIT/tests/batch-a-auth-json.mjs` — 31/31 pass (source-boundary assertions for all strict routes, no direct req.json outside parseJson, register-behind-auth + session-derived email + revoke/reissue, no double-SignJWT, shared cookie, logout revoke + 503 path, portal server-logout, JWT HS256 pin + claim shape + session-email binding, live jose good-token-accept / forged-token-reject).
- VERIFIED: Worker `tsc --noEmit` clean; SPA `tsc --noEmit` clean; production Vite build succeeds (known 1165 kB bundle warning = PERF-01, later batch).
- VERIFIED (browser, production build served locally): /login renders magic + password tabs with new copy; /careers/apply/success renders sign-in guidance card, no public password form.
- VERIFIED: `AUDIT/runtime/auth-regression.mjs` exercises anonymous/cross-email denial, magic-link verification, candidate ownership, password session replacement, JWT claim validation, malformed cookies, logout revocation and admin separation (14 groups). Live production checks independently confirm protected-route denial and hardened headers.

## Batch B — application integrity, safe candidate data and file boundaries

Status: IMPLEMENTED 2026-09-12; isolated runtime verified.

Changes cover active-job validation before writes, required job-slug binding, persisted `Idempotency-Key` replay protection, resume presence/size/signature checks, orphan cleanup when the database insert fails, safe object filenames, private candidate response fields, assessment links bound to the application reference, and attachment-style resume downloads. `application-regression.mjs` passes seven groups, including unknown/closed jobs, replay without duplicate writes/emails, missing or mismatched resumes, valid PDF storage/email behavior, and pre-shortlist room-link redaction.

## Batch C — platform hardening and honest UX

Status: IMPLEMENTED 2026-09-12; local browser/build checks verified.

Changes add API security headers and no-store caching, pin admin JWT algorithms and claims, normalize job booleans and dates, fix singular posting copy, add labels to public selects, replace the generic social destination with an explicit unavailable state, add a valid XML sitemap and robots reference, fix mobile admin overflow, add plain-text email alternatives, and remove silent third-party background loads. The editable external tech-check URL and combined MSI route are retired; generated checkers no longer bypass execution policy or collect hostnames. `techcheck-regression.mjs` passes both groups. The production Vite build, worker typecheck and SPA typecheck all pass.

Remaining verification: connected provider delivery/receipt, DNS authentication records, and exhaustive breakpoint/accessibility/performance coverage. The repaired Worker and Pages build have been deployed and live smoke-tested; the domain migration remains intentionally unexecuted.

## Batch D — production closure sprint

Status: IMPLEMENTED 2026-09-12; deployed and rechecked.

The historical Supabase pooler credential was classified without exposing its value; the current tree has no credential-bearing PostgreSQL URL, while provider-side validity remains UNKNOWN until the owner rotates/revokes it. The live Worker admin credentials were reconciled from the local project vault, and the production admin login then passed. The old Supabase management surface is unauthorized and its project hostname did not resolve during the fresh check, which does not prove revocation. Cloudflare zone/account tokens now verify active access to the production zone, Pages project, Worker versions/secrets and R2 bucket; distributed Rulesets/Rate Limiting endpoints still return 403 because the required zone permission is absent. Public DNS and Resend domain verification now pass read-only checks, and the designated owner mailbox receipt is now verified for the cache-busted supplied logo; broader product-message inbox coverage remains open. Controlled production contact, application, admin custom-mail, referral-invitation and referral-click flows returned successful handlers and delivered Resend messages; the synthetic application/resume and referral records were deleted. The absolute logo reference, plain-text alternative and Reply-To domain were present in each provider payload. Request-time DDL was retired from every service and replaced with a once-per-isolate read-only schema guard; migrations are now the only schema-write contract.

The sitemap now reads the live public job list through `GET /api/sitemap.xml`, with the build-time file as an API-down fallback. Missing form label associations were repaired on the job application form and admin login. Static Pages headers now add clickjacking, MIME-sniffing, referrer and permissions protections. Route-level lazy loading reduced the initial JavaScript chunk from about 1.16 MB to 323 kB; the largest remaining lazy chunk is ContactsAdmin. Live checks cover 30 route/viewport samples, five representative accessibility pages, protected API boundaries, dynamic sitemap, browser console state, the latest Pages deployment and production header behavior. Full evidence is under `AUDIT/evidence/`. Fresh referral, applicant-confirmation and magic-link messages now render in the connected Outlook mailbox, and `swiftjob.online` Email Routing is live with five enabled rules. The final gate remains NOT READY pending Gmail destination placement/bounce inspection, historical Supabase rotation, finer-grained rate-limit permission and Chrome DevTools MCP actions.
