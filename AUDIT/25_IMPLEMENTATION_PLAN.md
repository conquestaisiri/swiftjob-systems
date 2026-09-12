# SwiftJob audit and repair execution plan

Started: 2026-09-11. Baseline: `main`, commit `bc44d3820010a919436ff9b9f25a5e00a6ad5e9a`; working tree initially clean.

## Mission and constraints

Follow the owner's full-system program, including the four earlier inspection findings. Preserve working architecture and capabilities. No domain migration, destructive production tests, unrelated test-email recipients, or disclosure of secrets. Establish baseline before product edits. Evidence is VERIFIED only for behavior actually exercised; source conclusions remain INFERENCE.

## Phase gates

| Phase | Work and required evidence | Status |
|---|---|---|
| 0 | Repository, tooling, provider access and secret-handling inventory | COMPLETE |
| 1 | Architecture, all routes/roles, UI at 1440/1280/768/390, auth/API/data/email/assets/copy/security/SEO/performance baseline | COMPLETE (baseline evidence captured; public connected actions remain read-only) |
| 2 | Deduplicated findings with severity, causes, dependencies, verification requirements; repair batches | COMPLETE |
| 3 | Controlled repairs; objective, files, risk and tests recorded per batch | COMPLETE |
| 4 | Safe connected visitor/candidate/admin simulations; actual supported hiring-side roles; email receipt evidence | PARTIAL (isolated runtime and live boundary pass; real inbox receipt remains unverified) |
| 5 | Regression: permissions, forms, uploads, failure states, responsive UI, email, production build | COMPLETE for exercised coverage |
| 6 | Deployment, infrastructure, configuration, DNS/email authentication, domain-migration checklist | PARTIAL (deployment and live boundary pass; DNS/email authentication remains unverified; migration prepared, not executed) |
| 7 | Fresh finished-product review, 25 final answers, evidence-based scores and explicit readiness gate | COMPLETE with NOT READY gate |

## Execution order

1. Establish repository and access facts without revealing values; inventory active versus retired systems.
2. Capture build/type/test results and public/local browser baseline. Map API authorization, schema and every email event.
3. Document root causes and prioritize security/data consistency, primary workflows and email before interface polish.
4. Repair in coherent batches; use isolated/local fixtures for state-changing simulations. Preserve production data.
5. Verify real deployment and delivery only with appropriate available access; document precise remaining access needs after independent work.
6. Keep evidence, findings and completion checklist current across task continuations. Do not mark the goal complete while required work remains.

## Verification coverage

- Visitor: homepage, navigation, jobs, combined filters, pagination, query/back/refresh, legal/contact/error states.
- Candidate: apply/upload, duplicate/closed job, confirmation, magic-link/password/session lifecycle, portal ownership, assessment and updates.
- Admin: login, authorization, jobs/applications/referrals/campaigns/mail/contacts/settings/activity, mutations reflected publicly and in candidate state.
- Email: event inventory, rendering, text, sender/reply-to, links, retries/idempotency/operator visibility, designated mailbox receipt, DNS authentication.
- Cross-cutting: accessibility, breakpoints, truthful copy, assets, legacy branding, secrets/history, logs, migrations, CI, SEO/performance, domain dependencies.

Unsupported product roles/features will be documented as not implemented, rather than invented.
Live Cloudflare behavior is reported separately from isolated runtime evidence. The repaired Worker and Pages build are deployed to the existing domain; no domain migration has been performed. Resend delivery remains unverified beyond the synthetic sink.
