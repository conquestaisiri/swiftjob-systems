# Master findings

## Current disposition after repair and deployment

The entries below preserve the original baseline evidence. The current branch disposition is:

| Area | Current state |
|---|---|
| Candidate auth, JSON boundaries, JWT claims, session revocation and login throttling | Resolved in source; 15 isolated regression groups pass; live protected-route boundary checked |
| Application/job binding, idempotency, uploads, privacy redaction and assessment references | Resolved in source; 7 isolated application groups pass; additive migration applied |
| Checker safety, retired MSI/background endpoints and silent third-party loads | Resolved/retired; 2 checker groups pass; live retired route returns 410 |
| Headers, CORS, dynamic sitemap/robots, labels, mobile admin overflow, truthful copy and factual role strip | Resolved in source and build; live headers/CORS/sitemap and 30 responsive route/width samples checked |
| Real provider email receipt and SPF/DKIM/DMARC | Not verified; requires a designated mailbox/provider evidence |
| Core Web Vitals, contrast/screen-reader review and edge-distributed rate limits | Remain unverified or partially configured; initial route-level bundle splitting is verified |
| Domain migration | Prepared in `28_DOMAIN_MIGRATION.md`; deliberately not executed |

Initial baseline register. All findings remain open until their verification requirements are met. Source-only conclusions are distinguished from executed tests.


## AUTH-01 — CRITICAL


- **status:** OPEN

- **category role:** Security / candidate

- **source:** workers-api/src/index.ts; ApplicationSuccess.tsx

- **observed:** Public password registration trusts application ID/email; the public form can create that pair for any email. Existing hashes can be overwritten.

- **expected:** Require verified candidate session; derive ownership from session; move password setting into portal.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Require verified candidate session; derive ownership from session; move password setting into portal.

- **verification requirement:** Anonymous and cross-email attempts leave account unchanged; verified owner can set/reset.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** VERIFIED

- **final verification:** NOT VERIFIED



## AUTH-02 — HIGH


- **status:** OPEN

- **category role:** Authentication / candidate

- **source:** workers-api/src/index.ts; services/auth.ts

- **observed:** Password route signs an already signed session and sets the wrong cookie; portal rejects it.

- **expected:** Issue the existing signed session once, with the shared cookie name.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Issue the existing signed session once, with the shared cookie name.

- **verification requirement:** Password and magic-link tokens work with Bearer and cookie, and wrong/expired tokens fail.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** VERIFIED

- **final verification:** NOT VERIFIED



## AUTH-03 — HIGH


- **status:** OPEN

- **category role:** Authentication / candidate

- **source:** CandidateApplications.tsx; workers-api/src/index.ts

- **observed:** UI logout clears localStorage without server revocation; cookie/token remains usable.

- **expected:** Revoke before declaring sign-out successful; handle revocation failure.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Revoke before declaring sign-out successful; handle revocation failure.

- **verification requirement:** Old token and cookie rejected after UI/API logout.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** INFERENCE

- **final verification:** NOT VERIFIED



## API-01 — HIGH


- **status:** OPEN

- **category role:** API / all roles

- **source:** workers-api/src/index.ts parseJson

- **observed:** JSON helper recursively calls itself; valid contact JSON returns Required/400 and shared mutations fail.

- **expected:** Parse the request once; return null for malformed/non-object bodies.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Parse the request once; return null for malformed/non-object bodies.

- **verification requirement:** Valid contact/admin/assessment JSON accepted; malformed, null and arrays rejected with 400.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** VERIFIED

- **final verification:** NOT VERIFIED



## DATA-01 — HIGH


- **status:** OPEN

- **category role:** Data / candidate

- **source:** workers-api/src/index.ts; schema.ts; services/applications.ts

- **observed:** Application submission accepts nonexistent/closed job titles and no CV; fields lack trim/length rules and campaign slug is stripped.

- **expected:** Authoritative active-job binding, bounded normalized input, required CV, attribution.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Authoritative active-job binding, bounded normalized input, required CV, attribution.

- **verification requirement:** Valid apply works; unknown/closed jobs, whitespace and invalid files rejected without writes.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** VERIFIED

- **final verification:** NOT VERIFIED



## DATA-02 — HIGH


- **status:** OPEN

- **category role:** Data / candidate

- **source:** workers-api/src/schema.ts; repositories.ts; JobPage.tsx

- **observed:** No duplicate submission constraint or idempotency; client can resubmit after network uncertainty.

- **expected:** Define submission identity and safe replay using persisted constraint/idempotency.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Define submission identity and safe replay using persisted constraint/idempotency.

- **verification requirement:** Parallel/replayed submit produces one application and one logical notification set.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** INFERENCE

- **final verification:** NOT VERIFIED



## FILE-01 — HIGH


- **status:** OPEN

- **category role:** Storage / candidate/admin

- **source:** workers-api/src/services/storage.ts; services/applications.ts; index.ts

- **observed:** MIME-only CV checks, unsanitized names, pre-validation buffering, orphan upload on insert failure, deletion error swallowed.

- **expected:** Validate size/type/name/content; safe attachment headers; compensate failed insert and retain retryable deletion.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Validate size/type/name/content; safe attachment headers; compensate failed insert and retain retryable deletion.

- **verification requirement:** Wrong MIME/signature/oversize/empty rejected; storage/SQL failure recovery and ownership enforced.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** INFERENCE

- **final verification:** NOT VERIFIED



## AUTH-04 — HIGH


- **status:** OPEN

- **category role:** Privacy / candidate

- **source:** workers-api/src/index.ts candidate application responses

- **observed:** Raw application spread includes room/meeting fields before shortlist despite blank nextStep.

- **expected:** Explicitly redact unpublished private fields according to server status.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Explicitly redact unpublished private fields according to server status.

- **verification requirement:** New/rejected candidate JSON contains no private room/key; shortlisted owner sees intended data.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** INFERENCE

- **final verification:** NOT VERIFIED



## ASSESS-01 — HIGH


- **status:** OPEN

- **category role:** Workflow / candidate

- **source:** AssessmentPage.tsx

- **observed:** Null payload loading branch precedes error branch; completed result branch follows no-assessment branch.

- **expected:** Render errors and recorded completion first; add actionable recovery.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Render errors and recorded completion first; add actionable recovery.

- **verification requirement:** Missing/invalid/expired link shows error; completed assessment shows saved result on reload.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** VERIFIED

- **final verification:** NOT VERIFIED



## ASSESS-02 — HIGH


- **status:** OPEN

- **category role:** Trust / candidate

- **source:** PreChecks.tsx; workers-api/src/services/techcheck.ts

- **observed:** Instant validation declares success after delay without server report; installer bypasses downloaded-file safeguards.

- **expected:** Require actual evidence for verified claims; remove safeguard bypass and misleading success.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Require actual evidence for verified claims; remove safeguard bypass and misleading success.

- **verification requirement:** No verified status without report; no automatic unsafe installation; honest optional path.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** INFERENCE

- **final verification:** NOT VERIFIED



## ASSESS-03 — HIGH


- **status:** OPEN

- **category role:** Workflow / candidate

- **source:** AssessmentPage.tsx; PreChecks.tsx; workers-api/src/index.ts

- **observed:** Optional/no-pass-mark copy conflicts with speed/typing gates; track can depend on supplied job slug.

- **expected:** Use authoritative job track and consistent optional prechecks with bounded network probes.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Use authoritative job track and consistent optional prechecks with bounded network probes.

- **verification requirement:** Track substitution rejected; slow/mobile candidates can follow documented optional flow.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** INFERENCE

- **final verification:** NOT VERIFIED



## PRIV-01 — HIGH


- **status:** OPEN

- **category role:** Privacy / candidate/referral

- **source:** NextStepFlow.tsx; workers-api/src/index.ts

- **observed:** Background room flow silently loads third-party sites through multiple mechanisms and unbounded backend redirect fetch.

- **expected:** Remove silent background fetch; present explicit external action with validated URL.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Remove silent background fetch; present explicit external action with validated URL.

- **verification requirement:** No external request before user action; private/unsafe schemes rejected; room action works.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** INFERENCE

- **final verification:** NOT VERIFIED



## DEVICE-01 — MEDIUM


- **status:** OPEN

- **category role:** Access / candidate/referral

- **source:** lib/deviceGuard.ts; ReferralPage.tsx

- **observed:** Touch/coarse-pointer heuristics can block touch laptops and are presented as authoritative identity.

- **expected:** Use device hints for guidance; avoid unsupported definitive device claims.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Use device hints for guidance; avoid unsupported definitive device claims.

- **verification requirement:** Touch laptop/mobile behavior matches feature capabilities and provides usable next action.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** INFERENCE

- **final verification:** NOT VERIFIED



## MAIL-01 — HIGH


- **status:** OPEN

- **category role:** Email / candidate/admin

- **source:** workers-api/src/services/email.ts; services/applications.ts

- **observed:** Successful void email result is logged as failed; retries lack idempotency/classification/durable visibility.

- **expected:** Explicit send outcome; stable event identity; bounded transient retries; observable failures.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Explicit send outcome; stable event identity; bounded transient retries; observable failures.

- **verification requirement:** Successful HR send not logged as failed; uncertain retry does not duplicate; permanent failures visible.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** VERIFIED

- **final verification:** NOT VERIFIED



## MAIL-02 — HIGH


- **status:** OPEN

- **category role:** Email / all recipients

- **source:** workers-api/src/services/email.ts

- **observed:** No plain text part; real receipt, DNS authentication, sender/reply-to delivery not established.

- **expected:** Add text parity and verify designated real recipient/provider evidence.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Add text parity and verify designated real recipient/provider evidence.

- **verification requirement:** All real product email events reach test inbox; links/text/reply-to/headers checked.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** PARTIALLY VERIFIED

- **final verification:** NOT VERIFIED



## COPY-01 — HIGH


- **status:** OPEN

- **category role:** Trust / public

- **source:** ClientMarquee.tsx; LandingPage.tsx; CareersPage.tsx; Legal.tsx

- **observed:** Placeholder client endorsements and unsupported country/service guarantees conflict with implemented behavior.

- **expected:** Remove unverified endorsements; use factual neutral copy and consistent process/privacy language.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Remove unverified endorsements; use factual neutral copy and consistent process/privacy language.

- **verification requirement:** No fabricated proof; legal/product/assessment/email claims match observable behavior.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** INFERENCE

- **final verification:** NOT VERIFIED



## NAV-01 — MEDIUM


- **status:** OPEN

- **category role:** Navigation / public

- **source:** site navigation and footer

- **observed:** Homepage Candidate access opens careers; footer LinkedIn is generic; mobile menu lacks sign-in.

- **expected:** Point sign-in to login; remove generic social link until verified; expose mobile sign-in.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Point sign-in to login; remove generic social link until verified; expose mobile sign-in.

- **verification requirement:** Desktop/mobile candidate navigation reaches login and all footer links are meaningful.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** VERIFIED

- **final verification:** NOT VERIFIED



## A11Y-01 — MEDIUM


- **status:** OPEN

- **category role:** Accessibility / all roles

- **source:** JobPage.tsx; CareersPage.tsx; admin forms

- **observed:** Six application selects, four filters and other fields lack associated labels; errors are inconsistently announced.

- **expected:** Programmatic labels, descriptions, invalid state and error focus; audit shared form primitives.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Programmatic labels, descriptions, invalid state and error focus; audit shared form primitives.

- **verification requirement:** Named controls, keyboard traversal and error recovery at all widths.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** VERIFIED

- **final verification:** NOT VERIFIED



## COPY-02 — LOW


- **status:** OPEN

- **category role:** Copy / public

- **source:** CareersPage.tsx / date formatting

- **observed:** Job card renders 1 months ago.

- **expected:** Use singular/plural date formatting with date validation.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Use singular/plural date formatting with date validation.

- **verification requirement:** One month/day/year uses singular; invalid date has safe fallback.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** VERIFIED

- **final verification:** NOT VERIFIED



## SEO-01 — MEDIUM


- **status:** OPEN

- **category role:** SEO / public

- **source:** index.html; Pages Functions; SiteLayout

- **observed:** sitemap.xml returns HTML; metadata conflicts with positioning; protected indexing policy unverified.

- **expected:** Real sitemap, consistent canonical/meta, valid job data, noindex private/auth paths.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Real sitemap, consistent canonical/meta, valid job data, noindex private/auth paths.

- **verification requirement:** XML validates; metadata/canonical/schema reflect actual pages; private paths noindex.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** VERIFIED

- **final verification:** NOT VERIFIED



## PERF-01 — MEDIUM


- **status:** OPEN

- **category role:** Performance / public

- **source:** App.tsx; frontend build

- **observed:** All routes including admin/xlsx eagerly imported; main JS 1164.82 kB.

- **expected:** Split route-heavy code while preserving navigation and error fallback.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Split route-heavy code while preserving navigation and error fallback.

- **verification requirement:** Build and navigation pass; visitor payload reduced; measure runtime performance.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** VERIFIED

- **final verification:** NOT VERIFIED



## OPS-01 — HIGH


- **status:** OPEN

- **category role:** Deployment / operator

- **source:** pnpm-workspace.yaml; .github/workflows/ci-cd.yml

- **observed:** Frozen install fails allowBuilds; CI assumes pnpm auto-install, suppresses secret errors and deploys components independently.

- **expected:** Deterministic package setup; required tests/build gates; explicit successful release prerequisites.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Deterministic package setup; required tests/build gates; explicit successful release prerequisites.

- **verification requirement:** Clean install/checks/build pass; workflow validated; failure prevents publish.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** PARTIALLY VERIFIED

- **final verification:** NOT VERIFIED



## OPS-02 — MEDIUM


- **status:** OPEN

- **category role:** Data operations / operator

- **source:** workers-api/migrate.mjs; runtime schema helpers

- **observed:** Migration errors can continue; repeated request-time DDL and cached rejected schema promises complicate recovery.

- **expected:** Versioned fail-fast migrations and retryable initialization; avoid implicit data repair during reads.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Versioned fail-fast migrations and retryable initialization; avoid implicit data repair during reads.

- **verification requirement:** Fresh/upgrade/replay/failure migrations behave predictably and preserve data.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** INFERENCE

- **final verification:** NOT VERIFIED



## SEC-01 — MEDIUM


- **status:** OPEN

- **category role:** Security / all roles

- **source:** workers-api/src/index.ts; services/auth.ts; config.ts

- **observed:** JWT claims/cookie parsing need strict validation; security/cache headers absent; env/client state globally mutable.

- **expected:** Validate claims/algorithms and malformed cookies; request-safe bindings; appropriate headers.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Validate claims/algorithms and malformed cookies; request-safe bindings; appropriate headers.

- **verification requirement:** Malformed/forged/role-swapped/expired auth fails; private responses no-store; isolation tested.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** PARTIALLY VERIFIED

- **final verification:** NOT VERIFIED



## PRIV-02 — MEDIUM


- **status:** OPEN

- **category role:** Privacy / operator

- **source:** Legal.tsx; techcheck.ts; activities

- **observed:** Retention/all-actions-logged/no-install/privacy statements exceed verified implementation.

- **expected:** Align disclosures and implement or remove unsupported operational promises.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Align disclosures and implement or remove unsupported operational promises.

- **verification requirement:** Inventory matches disclosure; selected sensitive admin changes logged; retention policy actionable.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** INFERENCE

- **final verification:** NOT VERIFIED



## LEGACY-01 — MEDIUM


- **status:** OPEN

- **category role:** Maintenance / operator

- **source:** repository-inventory.json; history-secrets.json

- **observed:** 45 legacy mentions,38 domain dependencies and credential-shaped historical URLs need classification.

- **expected:** Classify safely; remove active stale references and literal credentials; document migration dependencies.

- **root cause:** See 24_ROOT_CAUSES.md; boundary/state/contract inconsistency described in observed behavior.

- **impact:** Affected role cannot rely on the expected behavior; severity reflects security, workflow or trust impact.

- **recommended correction:** Classify safely; remove active stale references and literal credentials; document migration dependencies.

- **verification requirement:** No active unwanted legacy branding or exposed real secrets; migration checklist complete.

- **evidence:** 05_BASELINE_REVIEW.md; 14_EMAIL_SYSTEM.md; evidence/workflow-baseline.json and associated source/DOM/provider evidence.

- **baseline verification:** PARTIALLY VERIFIED

- **final verification:** NOT VERIFIED
