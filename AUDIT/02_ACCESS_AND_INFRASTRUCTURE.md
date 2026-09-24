# Access baseline

| Surface | Evidence and access status |
|---|---|
| Local repository/toolchain | VERIFIED: Node 24.14.1, pnpm 11.18.0, Git and Python available. |
| Cloudflare | VERIFIED: the stored tokens read and edit `swiftjob.online` DNS, the Pages project, Worker secrets, and the `swiftjob-systems` R2 bucket. The apex CNAME, Pages custom domain, and Email Routing are active; five enabled rules cover admin, support, careers, HR, and catch-all forwarding to the configured Gmail destination. Distributed Rulesets/Rate Limiting remains separately gated. Values were not exposed. |
| Database | VERIFIED: existing ignored local connection works for SELECT. Schema/constraints/indexes and aggregate counts captured; no applicant PII exported. 131 total jobs, 95 publicly listed, 3 applications, 0 password accounts at inspection. |
| GitHub | VERIFIED for repository and hosted CI: `gh` is authenticated as the repository owner, PR #1 is open, and hosted CI run `34712839036` passes typecheck, isolated regressions and the frontend build. GitHub Actions production deployment jobs remain skipped on pull requests; repository secret values were not read. |
| Resend | VERIFIED for outbound sending: the stored live key reports `swiftjob.online` verified with sending enabled. Fresh referral, applicant-confirmation, and magic-link messages were delivered from `careers@swiftjob.online` and rendered in the owner Outlook mailbox. Resend receiving remains disabled by design; inbound aliases are handled by Cloudflare Email Routing. |
| R2 | PARTIALLY VERIFIED: account bucket listing succeeds; active binding points to swiftjobsystems. A controlled production PDF upload was created and removed with its application; broader lifecycle and failure-retry coverage remain unverified. |
| Backblaze | NOT VERIFIED: binding names exist; actual private MSI content, signing and download behavior not exercised. No installer was executed. |
| Render | NOT VERIFIED / apparently retired: current README and proxy use Workers. No active Render service verified. |

Current public domain is `swiftjob.online`; Pages project is `swiftjob-systems`, Worker is `swiftjob-workers-api`. The repaired Worker and Pages deployments are live. The latest Pages deployment is `b0ffae7a.swiftjob-systems.pages.dev`; the latest Worker version is recorded in `evidence/provider-access.json`. Production Worker secret names are `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`, `EMAIL_FROM`, `HR_EMAIL`, `JWT_SECRET` and `RESEND_API_KEY`; optional `SUPPORT_EMAIL` and `TURNSTILE_SECRET_KEY` are not configured. The retired Backblaze/MSI path has been removed from active configuration and code, and its unused `B2_APP_KEY`/`B2_KEY_ID` bindings are absent from the current Worker.

History scan examined 1,137 Git objects and flagged credential-shaped database URLs in historical text. Values are deliberately excluded. The current legacy migration helper now reads `DATABASE_URL` from the environment and contains no credential. Historical candidates still require operator classification and rotation. This regex scan does not prove all secrets are absent.

Remaining access needs are owner-side Supabase personal-access-token revocation (local copies have been removed) and a token/plan with zone Rulesets/Rate Limiting permissions for programmatic or finer-grained edge-rule changes. Email Routing for the new domain is verified in `evidence/email-routing-live-closure.json`; the database password was left unchanged.
