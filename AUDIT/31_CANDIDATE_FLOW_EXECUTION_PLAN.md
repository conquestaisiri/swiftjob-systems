# SwiftJob Candidate Journey, Hiring Operations, and Email — Execution Plan

**Purpose:** make application submission, candidate access, technical checks, assessments, role information, hiring-team review, and email behave as one coherent product. This is a working implementation plan; it does not authorize a production deployment or sending test emails.

## Verified baseline

- The current checkout is `codex/techcheck-zip-launch-retry`, at `45b57d4`. At the start of this work there were no tracked local changes. Existing untracked user files are being preserved.
- The public jobs API currently returns **95 live roles**. The checked-in static fallback also contains **95 role records**. Earlier discussion mentioned 411 roles, but that total is not represented by the public API or this fallback; hidden/admin-only roles and their count still need an authoritative admin export before they can be audited or rewritten.
- The application status model is `New`, `Reviewing`, `Shortlisted`, `Rejected`, and `Hired`. A transition to `Shortlisted` is already a deliberate admin action and already supports notifying the candidate.
- Before this work, the public assessment read, draft-save, and submit endpoints did not require that admin transition. The candidate portal could also present an assessment immediately after the technical check.
- The public application form is currently one fixed set of questions for every role. Job descriptions share a template and repeat an “About SwiftJob” section. The old “short skills check in your browser” text was present in all 95 static records and could also come from database-backed role data.
- Applications may be submitted before candidate sign-in. The candidate portal later lists applications by the email on the verified magic-link session. Before this work, the public application endpoint also wrote submitted details into a profile keyed only by the unverified email; that profile write has been removed, while application creation and referral attribution remain independent.
- Candidate authentication already supports a 15-minute, one-use email magic link, a seven-day session, and an optional password. Google sign-in is not implemented and requires an OAuth client configured by the account owner.
- The current technical check has both browser-side prechecks and legacy Windows launcher/MSI packaging code. Browser APIs cannot reliably expose exact laptop model, CPU model/clock, installed RAM, or GPU details. Native collection requires a clearly disclosed, user-launched program. No MSI/checker has been run or installed on the user's computer.
- Email templates already share a common HTML layout, but CSS alone cannot force every mail client to honor the same dark-mode behavior. That needs client-by-client preview and rendering verification.
- The admin recipient entry is a plain textarea, and the compose panel uses a two-column CSS grid. The recipient field now has a fixed vertical size and internal vertical scrolling; long addresses wrap instead of widening the panel.
- Available package checks are TypeScript typechecks and a Vite production build; there is no existing automated unit/e2e test suite in these packages.

## Stage 1 — Lock the actual hiring workflow

### Intended journey

1. Candidate submits an application. The application and resume are saved first; the applicant does not need to register before applying. They receive a confirmation and can later prove ownership by signing in through the same email address.
2. The candidate can complete the separate technical check and return to it. Completing it is recorded against that exact application. It does **not** start a role assessment.
3. The recruitment team reviews the application. `Reviewing` remains a waiting/review state; candidates see the current state and no role-assessment form is exposed.
4. An admin deliberately changes the application to `Shortlisted` to advance it. Only then does the role assessment become available (and only when that role has one). The candidate receives the next-stage email when notification is enabled.
5. `Rejected` and `Hired` applications do not accept assessment submissions. If an admin changes an application out of `Shortlisted`, assessment access closes until it is advanced again.

### Implemented locally in this first slice

- The assessment API now reports the invite state and withholds draft/results before `Shortlisted`; POST and draft-save endpoints reject uninvited applications server-side.
- Assessment access now also requires a completed, usable technical-check report. Read, draft-save, and candidate-portal views all use the same shortlist-plus-tech-check gate, so an early direct URL cannot reveal stored assessment work or save new progress.
- The success page, assessment route, and candidate portal now distinguish a completed technical check from an assessment invitation.
- The admin Shortlist action explains that it advances the candidate and unlocks the assessment after the technical check.
- A successfully consumed, application-bound technical-check token now records an admin timeline event and queues one HR notification naming that application. Device specifications stay in the authorized application record, not in email; duplicate token reports cannot resend it.
- Confirmation and next-stage email copy now follows the same ordering; the review target is consistently stated as **2–3 business days**.
- Legacy short-skills-check copy is normalized at job API boundaries and corrected in the checked-in fallback data.
- Public application submission no longer writes a profile using an unverified email.
- The role page no longer repeats the company “About SwiftJob” section.

### Acceptance checks

- New/Reviewing candidate: direct assessment URL reveals no question/configuration, draft, or result; direct POST and draft-save return a locked response; technical check still works.
- Shortlisted candidate: assessment appears only after technical check; saved progress continues; admin notification names the right person and role.
- Status changed back from Shortlisted: new writes are blocked server-side and UI explains the lock.
- No-assessment role: technical check completes without a fake “assessment missing” state.
- Repeated status saves do not send duplicate status emails; notification opt-out is honored.

## Stage 2 — Candidate identity, account, and repeat applications

### Implemented locally in this slice

- The public header and footer now link a browser with a saved candidate session to the candidate portal; cross-tab and route changes refresh the state. Protected candidate routes remain responsible for validating and clearing expired/revoked sessions.
- The application success and magic-link screens now explain that first-time applicants activate portal access after verifying the email used for their application; copy no longer says an account was fully created before verification.
- The success-page portal handoff now carries the application email into the magic-link screen, with a clear application-specific prompt. Verification still happens through the candidate's inbox; opening portal setup does not silently send a message.
- A verified candidate's reusable profile and latest application can prefill known application fields. Role-specific cover-letter text is intentionally left blank for the candidate to write for the new role.
- The candidate can explicitly select the CV attached to a prior application or upload a replacement. The API verifies the signed-in email owns the source application, never returns the private R2 object path, and copies the file to an independent object for the new application so deleting either application cannot delete the other's CV.
- Unauthenticated applicants can still submit normally. A saved-CV application without a valid candidate session is rejected; the application email must match that verified account.

- Keep apply-first available. A successful application must never be lost if the candidate postpones account setup.
- Treat the emailed magic link as proof of email ownership. After verification, all applications for the normalized verified email should appear in the portal without resubmitting.
- Keep passwords optional; after first verified sign-in, offer a clear, optional way to set one. Show the signed-in account/portal link consistently on public pages and keep the session across routes.
- Build profile editing around verified candidate access. Do not let an unauthenticated application overwrite another person's profile.
- Add resume reuse only through a server-verified candidate session: show the saved file, let the candidate choose it or upload a replacement, and keep each application’s submitted resume snapshot attached to that application.
- Decide whether candidates need one current resume or a small versioned resume library. Do not silently replace a candidate's saved file when they apply with a different CV.
- Google sign-in is a separate optional enhancement. It needs the owner's Google OAuth client ID, authorized origins/redirects, and a security review; it must not be faked with a front-end-only button.

## Stage 3 — Role-specific listings and application forms

- Reconcile the **95 public records** against the authenticated admin catalogue, including inactive/draft roles. The “411” figure cannot be treated as verified until its source is supplied or an authorized export is available.
- For every confirmed role, write role-specific: purpose/outcomes, day-to-day responsibilities, required and preferred qualifications, tools, working hours, compensation/arrangement, hiring steps, and application questions. Remove generic filler and do not invent compensation, credentials, client details, or guarantees.
- Retain shared contact, consent, and resume fields where needed, but drive role questions from explicit per-role configuration; make genuinely irrelevant questions disappear instead of merely changing their labels.
- Store the question set/version and submitted answers with the application so the admin sees exactly what the candidate answered later. This requires a reviewed database migration and a compatibility path for existing application rows; it must be tested before any Worker deployment.
- **Implemented locally (first questionnaire slice):** a shared question catalog now has an individually tailored first required prompt for each of the **95 published fallback roles**, plus role-family follow-up prompts. New/admin-created roles receive relevant family defaults, and admins can replace defaults with up to six prompts per listing. The application validates answers against the current job on the server and stores each submitted prompt beside the answer; candidate and admin application details can review the saved responses. Migration `016_role_application_questions.sql` adds safe-default JSONB columns. The authenticated hidden/draft catalogue still needs an admin export before those roles can be tailored; this is not a verified rewrite of all 95 role descriptions or employer-specific facts.
- **Implemented locally (description cleanup slice):** known repeated template overviews, responsibility bullets, and baseline qualifications now resolve to role-family-specific text on both API-fed and static-fallback job pages. A comparison against all 95 public fallback records found 52 with those exact boilerplate patterns; their repeated sections are replaced, while the 43 records with distinct authored text are preserved. This does not certify employer-specific facts, compensation, tools, or hidden roles; those still require confirmation against the authorized job catalogue.
- The application form now uses those role questions instead of also requiring a separate generic cover letter and duplicate long-form experience essay. Legacy database columns remain compatible and are stored as empty strings for new submissions that use the tailored questions.
- Keep hidden roles editable and auditable without making them public. New-job authoring instructions should document the required detailed role content and form configuration so another agent cannot publish a thin copy-paste listing.
- Run a consistency audit across landing page, Careers, role pages, success page, portal, emails, and admin wording so each page describes the same actual stages.

## Stage 4 — Admin review and operations

- Keep one complete application record per role application, including uploaded CV snapshot, profile answers, technical-check status/report, assessment state/result, referrals, and timestamps.
- **Implemented locally (timeline slice):** newly submitted applications, first saved assessment progress, assessment completion, technical-check completion, and admin status transitions are recorded as application-linked timeline events. Status events show the from/to state and whether a candidate email was sent, failed, or not requested. A failed timeline write is logged without falsely reporting that the already-saved application/status failed.
- **Implemented locally (mail recipient validation):** pasted recipient lines are now parsed into unique addresses; malformed lines are surfaced and block sending; duplicate addresses are disclosed and sent once; the 100-recipient server/client limit is surfaced before submission. Focused parser tests cover plain and named addresses, invalid entries, and duplicates.
- Continue extending the application timeline to cover remaining meaningful candidate actions and show assessment “in progress” state alongside completed/not-started/locked states. Existing applications do not receive retroactive events from this change.
- Make every candidate action and admin transition visible in an understandable application timeline. Clearly distinguish “not started,” “in progress,” “completed,” “invited/locked,” and “failed to save.”
- Make advancement an explicit, reversible admin decision with a confirmation that names the candidate and destination stage. Keep notification opt-out visible and show whether the email actually sent.
- Review dashboard filters, status counts, application detail, resume access, next-step settings, referral attribution, and error states as one operational workflow. Remove controls that have no connected purpose.
- Keep mail-recipient entry vertically bounded and scrollable; validate pasted lists, duplicate addresses, invalid addresses, and batch limits before send. The visual scrolling fix is implemented locally; behavior at 50–100 recipients remains to be tested.
- Separate a candidate-visible progress state from HR-only notes. Never put another candidate’s name, role, CV, link, or report in a status email.

## Stage 5 — Email system and dark-mode rendering

- Inventory each template and trigger: application confirmation, HR new-application notice, review/status update, next-stage invitation, rejection, offer, technical-check completion, assessment completion, sign-in link, contact notification, and referral mail.
- For each template, verify its inputs are application-bound (`fullName`, `position`, reference, correct portal URL) and its trigger is a real state change. Use short, direct copy and the same 2–3-business-day review target where appropriate.
- Keep high-priority candidate events sparse. The current flow sends an applicant confirmation and HR notification per application, candidate status updates on admin status changes, and magic links on request. The actual Resend account plan and deliverability settings cannot be inferred from source code and must be checked in the account before setting an operational daily limit.
- Validate the shared design in Gmail web/mobile, Apple Mail on iOS/macOS, and Outlook desktop/web, both light and dark. Use robust HTML table/layout, inline critical colors, meaningful contrast, and light/dark logo assets in a white badge if needed. Record where a client ignores media queries or applies its own color inversion rather than claiming universal control.
- Test generated previews locally; do not send test emails to real candidates or alter sender/account settings without an explicit release/test-recipient scope.

## Stage 6 — Technical check, consent, and data handling

- Keep the browser check limited to information browsers are allowed to report and disclose its limits. Do not claim browser JavaScript can precisely identify hardware it cannot access.
- If exact model/CPU/RAM/GPU data is required, choose a transparent, user-initiated native checker separately from the role assessment. Present the publisher/source, exact fields collected, purpose, destination, retention, and how to cancel before download/run. Bind the result to a short-lived one-time application token; never trust a client-supplied application ID by itself.
- Do not hide execution, suppress Windows/browser warnings, evade antivirus reputation, or collect serial numbers, files, passwords, or browsing history. The candidate must deliberately run/authorize any native utility; the developer will not install or run it on the user's laptop.
- Store only the requested technical fields, make the report available to the applicant and authorized admins as appropriate, and surface completion in the admin timeline. Send one HR completion notice only when the one-time report is successfully recorded; do not include device specifications in email or send notices for download/start attempts.
- Decide the final artifact flow before deleting/replacing packaging paths. At present the repository still contains legacy launcher/MSI-related server code; the original MSI/package files are external user data and are not modified by this local work.

## Stage 7 — Verification and release

- Run Workers and frontend typechecks, frontend production build, static search for obsolete copy, and focused API/UI behavior checks after each stage.
- Add automated tests for stage authorization, application-to-candidate linking, role-form validation/versioning, notification triggers, and stale/duplicate submissions before schema-heavy features ship.
- Validate narrow mobile layouts, accessibility labels/keyboard flow, long job text, admin recipient lists, and dark/light email previews.
- For any schema change, review the SQL migration, apply to a non-production database, verify old rows and rollback/forward compatibility, then deploy Worker/frontend in a documented order.
- No production push/deploy is part of this plan's initial “start” step. Release only after the full end-to-end acceptance checks pass and the user explicitly chooses the live rollout window.

## Research references

- Indeed’s [official resume/profile help](https://www.indeed.com/help/job-seekers/articles/4408783727629-uploading-a-resume-file-to-your-profile) and [profile overview](https://www.indeed.com/profile/cs) describe keeping a resume and work preferences in a reusable candidate profile.
- Jobberman’s [candidate profile help](https://help-center.jobberman.com/portal/en/kb/articles/updating-your-job-seeker-profile) and [CV upload walkthrough](https://www.jobberman.com/discover/apply-for-jobs-faster-in-nigeria-with-jobbermans-improved-cv-upload-experience) describe profile/CV reuse and extracting profile fields from a CV.
- LinkedIn’s [application-data help](https://www.linkedin.com/help/linkedin/answer/a507694) describes reuse of recent resumes and controls over saved application data.
- Email-client constraints should be verified against [Gmail email CSS guidance](https://developers.google.com/gmail/design/css?hl=en) and [Apple Mail dark-mode implementation guidance](https://developer.apple.com/videos/play/wwdc2019/511/).

## Execution update — 2026-09-24

- The admin timeline now records the first saved role-assessment draft as “Started role assessment,” separately from completion; failed event writes remain non-fatal and are logged.
- Assessment reads, draft writes, and candidate-portal summaries are now gated on both the admin shortlist and a completed technical check. A focused regression test covers New/Reviewing/Shortlisted/Rejected/Hired statuses and incomplete/complete checks.
- The application-success portal handoff now includes the application email and an application-specific verification explanation. The local success-page check confirmed the generated link; it did not send a sign-in email.
- Local role-list and role-detail routes render from the static fallback when the local API is unavailable. No application was submitted during this check.
- Frontend and Worker typechecks passed; all 12 focused question/recipient/email-template/assessment-gate tests passed; the frontend production build and Worker deployment dry-run passed; `git diff --check` passed. Vite still emits its known non-fatal tooltip sourcemap warning.
- Migration `016` was also applied in a disposable local Postgres-compatible runtime against representative pre-existing `jobs` and `applications` rows; both JSONB columns were non-null and existing rows received the empty-array defaults. This verifies the migration SQL itself, not the full production schema or live database state.
- Before release, the production HTML still referenced old JS/CSS hashes; that release blocker is now resolved by the verified production deployment recorded below.
- The public/static catalogue remains 95 roles; the earlier read-only baseline reported 131 total/95 live/36 hidden, but hidden-role detail content has not been exported and reviewed here.
- Production release completed on 2026-09-24 after the user supplied the Neon production PostgreSQL connection string. Read-only validation confirmed `neondb` / `neondb_owner`; migration `016` was applied and both required JSONB columns verified. The Cloudflare Worker `swiftjob-workers-api` secret and GitHub Actions `production` environment secret `DATABASE_URL` were updated.
- Worker version `79c72e90-c854-485c-9d32-01d71a62b012` was deployed. The frontend build was deployed to Cloudflare Pages project `swiftjob-systems` on branch `main` (`d6dbb562.swiftjob-systems.pages.dev`). Live checks: homepage, `/careers`, `/careers/ai-data-annotator-labeler`, `/favicon.svg`, `/api/healthz`, and `/api/jobs` all returned HTTP 200; the public jobs endpoint returned 95 roles.
- Release checks passed: shared-library, Worker, and frontend typechecks; Vite production build; auth, application, and tech-check regression suites; and Worker dry-run. The application regression fixture now submits the required role-specific answers generated by the public job response.
- Remaining verification is explicitly limited to real recipient email rendering/delivery in Gmail, Apple Mail, and Outlook, and a controlled human candidate/admin end-to-end run. The Windows checker was not run or installed on the user's computer.
