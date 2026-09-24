# SwiftJob repository guidance

## Candidate and hiring workflow

- An application may be submitted before account creation. Do not create or update a candidate profile from an unverified application email; bind portal access only after the candidate verifies that address.
- Keep each application self-contained: save its answers and its own resume copy, and never expose another candidate's data through profile reuse, portal responses, or email.
- The technical check is separate from a role assessment. A role assessment is available only after an authorized admin advances that application to `Shortlisted`; enforce this in the UI and every read/write API, not just by hiding a button.
- Keep application status, technical-check completion, assessment invitation/progress, and next-step instructions distinct in the candidate portal and admin timeline.
- A technical-check report is accepted only through its short-lived, one-use token bound to that application. Do not trust a client-provided application ID, include hardware details in email, conceal execution, or attempt to evade operating-system/browser security warnings. Any native checker must be clearly disclosed and deliberately launched by the candidate.

## Job listings and application forms

- Write role-specific job content: what the work delivers, actual responsibilities, required and preferred qualifications, tools only when verified, schedule, pay, work arrangement, and the real hiring stages. Never invent compensation, client names, licences, benefits, or guarantees.
- Retain the shared contact and resume fields only where they are genuinely needed. Every published fallback role has a distinct first prompt in `shared/role-application-prompts.ts`; keep that catalogue in sync with `artifacts/swiftjob-systems/src/data/jobs.ts`. Family follow-up prompts are defaults, and admins may replace them in the Jobs editor. For a new role, add a role-specific prompt when it is published or an explicit admin override; keep prompt IDs unique and bounded.
- Validate dynamic questions on the server against the job's current configuration. Persist the prompt with each answer so later edits cannot change what an applicant actually submitted. Show those saved answers in both the candidate's own application and the authorized admin review.
- Keep hidden and inactive roles admin-only. The public API and static fallback currently establish the public catalogue, not the full hidden catalogue; do not assume a reported role count without an authenticated export.

## Database, email, and release

- Add schema changes as ordered, additive SQL files under `workers-api/migrations/`; update Drizzle schema and the startup schema guard together. Do not apply migrations to production while developing or typechecking.
- Keep candidate email short, correctly bound to that application, and triggered by a real status change. Keep device/system specifications out of email. Use the shared template layout in `workers-api/src/services/email.ts`.
- Email clients can override dark-mode CSS. Use the local light/dark previews for regression checks, but do not claim universal rendering without checking the target mail clients.
- Run frontend and Worker typechecks, focused tests, and a production build after changes. A successful local build does not mean database migration, email delivery, or deployment succeeded.
- Do not deploy, publish, send real test email, change production data, or run/install the Windows checker unless the user explicitly asks for that specific action.
