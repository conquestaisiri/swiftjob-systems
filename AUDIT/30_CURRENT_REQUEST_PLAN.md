# SwiftJob current product-flow plan

Updated: 2026-09-24

> Release note (2026-09-24): the follow-up candidate-flow implementation has since been deployed to Cloudflare Pages production and the Worker. The live database connection was verified, migration `016` was applied, and the GitHub Actions `production` environment now has its `DATABASE_URL` secret. Release verification is recorded in `AUDIT/31_CANDIDATE_FLOW_EXECUTION_PLAN.md`.

## Objective

Make SwiftJob understandable and dependable from the first visit through application, required technical check, role assessment, candidate portal, recruitment communication, referrals, and admin control. Every visible step must answer three questions clearly:

1. What is this step?
2. Why is it needed for this role?
3. What can the person do now, and what happens if they return later?

The technical check is mandatory for every application. A role assessment is a separate step and is selected by the role or role group. A typing test is only included when the role genuinely requires typing speed or accuracy. All check progress must be saved against the application and resumed from the candidate portal.

## Decisions for this repair batch

- Remove the landing-page label “People at work.”
- Keep the current “Different work. Same standard.” section unchanged.
- Keep the “Different work. Same standard.” section and its images unchanged. No generated imagery will be used. The separate Careers hero uses real remote-work photography; retain the source links below and verify each asset/license before publication.
- Replace the hero headline with direct language that explains the service rather than using “Good people. Good work. Better matched.”
- Replace “Tell us about the work.” with a clearer next-step invitation.
- Correct the landing-page candidate guidance so it distinguishes the compulsory technical check, role assessment, and role-dependent typing test.
- Make the email layout render intentionally in light and dark mail clients, including a light logo for dark mode and high-contrast surfaces, labels, links, callouts, and buttons.
- Make referral invitations use a required job selector populated from live open roles. The server will validate the selected job and derive the title rather than trusting free text.
- Preserve duplicate-send protection, but explain “Already sent” as a clear, recoverable state in the admin UI. A deliberate resend action can be added after the first repair batch without weakening the default safeguard.
- Show admin job totals as total, live, and hidden so the 131-versus-95 difference is explicit instead of looking like missing data.

## Phase 1 — immediate clarity and reliability repairs

### Public landing page

- Remove the redundant hero label.
- Use a plain, service-led headline and retain the existing dual paths for employers and professionals.
- Keep the requested “Different work. Same standard.” section and its copy/layout unchanged.
- Correct the candidate portal section to say: every application has a required technical check; some roles add a role assessment; typing is included only where the work needs it; progress is saved.
- Use an action-oriented contact heading and keep the form’s existing audience choices and success/error states.

### Email rendering

- Use the shared email layout for contact, application, magic-link, status, referral, and admin custom messages.
- Provide dark-mode selectors used by Gmail/Outlook-style transformations as well as `prefers-color-scheme` rules.
- Swap between the dark lockup on white and the light lockup on dark; never place the dark-green wordmark on an inverted dark header.
- Give every repeated surface a class-backed background/border/text color so dark-mode clients do not rely on brittle inline-style rewriting.
- Keep a plain-text alternative, escaped user content, absolute links, and Reply-To behavior.
- Render a contact-message preview in light and dark themes and capture screenshots before publishing.

### Admin mail and jobs

- Load active jobs into the referral-invite selector.
- Require a selected job for referral invites; leave custom messages independent of a job.
- Validate the selected job server-side and use its canonical title in the referral record and email.
- Improve the delivery result wording: distinguish delivered, duplicate/already sent, daily limit, and provider failure.
- Add a live/hidden breakdown to the Jobs header. Public careers will continue to show only active jobs, so the count will be truthful in both places.

## Phase 2 — application flow contract

Document and then verify the complete flow:

`Landing → role list → role detail → application form → received page → account/magic link → candidate portal → compulsory technical check → optional role assessment/typing step → saved progress → review status → status email → next action`.

For each route, check the first viewport, page title, next action, back/return path, loading state, missing/expired link state, duplicate application state, mobile-device blocker, and desktop continuation. A candidate who stops after applying must be able to return by email or password and see exactly what remains.

Duplicate applications will be handled by role and email: show the existing application and offer “Continue existing application” or “Cancel and start again” only where restarting is safe. Do not create silent duplicate rows.

## Phase 3 — check and assessment model

- Keep the technical check as a mandatory application gate.
- Store explicit per-role requirements: technical check, browser/connectivity checks, system checker, typing test, and role assessment.
- Replace department-only inference with role configuration that can be reviewed in admin. This full per-role authoring UI is not part of the restored Phase 1 changes yet.
- Give each assessment a canonical title containing the actual role or role group; never show a generic “Office & Support Assessment” for a captioner, subtitler, or unrelated job.
- Give each assessment a version, question set, scoring rule, time guidance, and completion state. Save drafts by application and assessment version.
- Let admins preview, publish, retire, and assign assessment tracks without editing code. Retired versions remain readable for historical applications.
- Keep typing thresholds role-specific and explain that the test is used only when the role requires it.
- Block browser sessions identified as mobile before any technical check, typing test, or role assessment. Re-check every entry point. Browser signals are not hardware attestation: desktop-site mode can mask a phone, and a one-time report is not cryptographically bound to the device running the assessment. Do not claim a strict, spoof-proof PC-only gate until a technically enforceable design and real-device regression establish it.

## Phase 4 — candidate portal and profile

- Treat the portal as the source of truth for applications and next steps.
- Show a clear progress stack per application: technical check, typing test when applicable, role assessment when applicable, and review status.
- Replace ambiguous fractions such as “1/4” with labeled progress such as “Technical check complete” and “Role assessment: 2 of 5 questions answered.”
- Provide resume/CV visibility, saved files, profile editing, location/timezone, work preferences, links, skills, education, and an audit-safe updated-at indicator.
- Define mandatory profile fields before the candidate can apply using the profile for another role; preserve the original application snapshot for historical accuracy.
- Support applying to another open role from the authenticated portal without forcing a second account or losing the existing profile.

## Phase 5 — job catalog and admin control plane

- Establish the canonical job count and status definitions first: total records, live records, hidden records, archived records, and deleted records.
- Expand toward the requested 411 roles only through a reviewed catalog import, not fabricated duplicates. Each role needs a unique slug, title, department, remote arrangement, compensation, summary, qualifications, skills, tools, hiring process, technical requirements, typing requirement, assessment assignment, and active status.
- Research role families from legitimate public sources and rewrite descriptions into SwiftJob’s own language. Do not copy proprietary job-board text or publish roles without a real hiring purpose.
- Add an import/preview/validation path in admin with duplicate-slug, duplicate-title, missing-field, and assessment-assignment warnings.
- Add admin controls for role requirements and assessment assignment, with clear impact labels and an audit event for every mutation.
- Keep public careers limited to intentionally live roles; make hiding a role explain that existing applications remain accessible.

## Phase 6 — technical checker

- Audit the generated Windows and macOS checker payloads, token lifetime, report verification, one-time use, expiry, and stored fields.
- Make the download page describe exactly what is checked and what is not collected.
- A `.bat` file cannot display a trustworthy Windows publisher identity by itself. If a verified publisher name is required, replace it with a signed executable/package using a real code-signing certificate and verify the signature on a clean Windows machine before shipping. Until then, do not imply that the batch file is publisher-verified.
- Keep the checker PC-only and ensure failed, expired, repeated, or missing reports produce a clear next action.

## Verification gates

- Typecheck and production build for both the Pages app and Worker API.
- Light/dark email screenshots at phone and desktop widths, including the supplied contact-message content.
- Landing, careers, admin mail, and candidate assessment screenshots at desktop and mobile sizes.
- API checks for public live/hidden job counts, referral selector validation, duplicate-send messaging, and custom-mail failure reporting.
- Candidate flow regression: apply once, resume later, complete technical check, complete or skip the role-dependent assessment, and verify the portal state.
- PC blocker regression on a real mobile profile, desktop-site mode, and ordinary desktop browser.
- Publish only after the local source, built output, and live deployment agree.

## Current status

Phase 1 source changes were committed locally as `8b9bd91` and deployed directly
to Cloudflare Pages production on 2026-09-23 (`75442539.swiftjob-systems.pages.dev`)
and to Worker version `8d75c318-e5e7-4038-9a0b-f680e1e553d2`. Production browser
checks confirmed the revised hero, removed label, corrected candidate steps,
new contact heading, Careers images, favicon, 95 live roles, and healthy API.

At that time GitHub `main` was not advanced because credentials were not
available. On 2026-09-24 the follow-up release was deployed to the `main`
production branch after the production database was repaired and the release
checks passed. Local research, screenshots, reports, and unrelated files were
excluded from the website upload.

- The landing hero now uses clearer remote-work messaging, and the “People at work” label is removed.
- The “Different work. Same standard.” category section and its current images were intentionally left unchanged after review.
- The portal-step copy now distinguishes the compulsory technical check from role-dependent typing and assessment steps.
- The contact email template now has separate light/dark logo and surface treatments. The approved dark-mode treatment uses one near-white pale-mint surface for the header/banner and all info-table label cells; local light and dark renders were captured and reviewed before release.
- The local email renders are design previews, not proof of how Gmail on the user's phone renders the message. The supplied Gmail dark-mode screenshot still needs a real inbox test; do not mark that issue fixed based only on browser previews.
- Referral invitations now require an authenticated, active-job selection in admin; the server validates the selected role and stores its canonical title.
- Duplicate-send results explain that an already-sent invitation was prevented, and the Jobs header reports total, live, and hidden counts.
- Privacy copy now says the system-check report is required and that typing metrics are collected only for roles requiring them. Assessment draft saves are debounced and serialized, and pending changes are flushed before submit to prevent an older request overwriting newer answers.
- Browser device checks remain a best-effort gate; physical laptop/desktop enforcement against mobile desktop mode is not verified or guaranteed. The candidate copy and code comments must not promise otherwise.
- Clean-checkout library/frontend/Worker typechecks and frontend production build passed. The Worker dry run and all three CI regression suites passed. The generated checker no longer invokes PowerShell with `ExecutionPolicy Bypass`.

### Careers hero photo sources (not the unchanged “Different work” section)

- Customer support: [Pexels photo 7690318](https://www.pexels.com/photo/a-call-center-agent-working-from-home-7690318/)
- Remote home-call work: [Pexels photo 4474047](https://www.pexels.com/photo/woman-working-at-home-and-making-video-call-on-laptop-4474047/)
- Laptop video-call team: [Pexels photo 5486096](https://www.pexels.com/photo/a-group-of-people-chatting-in-a-video-call-in-a-laptop-5486096/)

The three corresponding local JPEGs are used by the Careers hero. Confirm their
Pexels pages list them as free photos, and Pexels' current license permits
website use without required attribution. Do not imply that pictured people
endorse SwiftJob or are SwiftJob staff. No AI-generated images are used for
this collage.

### Recovery-pass verification (2026-09-23)

- Frontend typecheck: passed.
- Worker API typecheck: passed.
- Frontend production build: passed. Vite printed a non-fatal sourcemap warning for `src/components/ui/tooltip.tsx`.
- Worker Wrangler deploy dry-run: passed; this only bundled the Worker and did not deploy it.
- `git diff --check`: passed; Git printed only its existing LF/CRLF conversion notices.
- Local desktop and 390px mobile screenshots were visually reviewed. The desktop shows the revised hero; the Careers hero's support, home-call, and video-call photos read as remote work at both widths.
- The local Vite session logged connection-refused errors for `/api/jobs`; it did not have a reachable Worker/database. Local screenshots therefore verify layout/copy only, not live job counts or admin/candidate API behavior.
- Live homepage verification confirms the old “People at work” label and old contact heading are gone; the new service hero, candidate guidance, and “Let's work out the next step” heading are served. All three Careers photos loaded in the browser, and `/favicon.png` returned HTTP 200.
- Actual Gmail dark-mode rendering remains unverified. The local preview matches the requested pale-mint panels and labels, but Gmail iOS must be checked from a real delivered test email after release.
- No applicant/admin workflow has been submitted during verification. Live referral delivery, a real email-client dark-mode render, and the full candidate flow still need controlled end-to-end tests.
- The production-connected database check found 131 jobs total (95 live, 36 hidden), the duplicate-application index already present, and zero conflicting duplicate pairs. This matches the public jobs endpoint.
- The MSI was not opened, installed, or executed during this recovery pass. The launcher source remains unsigned; Windows will still identify an unsigned package as an unknown publisher until a real code-signing certificate is used.
- The PC-only blocker is best-effort browser detection, not hardware-bound enforcement. Real phone and desktop-site-mode testing is still required, and the server's single-use report is not bound to the browser's physical device.

The 411-role catalog, full admin control plane, complete per-role assessment matrix, strict PC blocker regression, and signed checker remain subsequent phases. They require reviewed role data, explicit assessment ownership, real device testing, and a real code-signing identity; they should not be bulk-filled or implied by the Phase 1 copy changes.
