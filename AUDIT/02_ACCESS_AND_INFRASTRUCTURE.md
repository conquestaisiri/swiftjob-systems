# Access baseline

| Surface | Evidence and access status |
|---|---|
| Local repository/toolchain | VERIFIED: Node 24.14.1, pnpm 11.18.0, Git and Python available. |
| Cloudflare | VERIFIED: the supplied zone token is active and reads `payservice.top` DNS; the supplied account token reads the `swiftjob-systems` Pages project, `swiftjob-workers-api` versions/secrets, and the `swiftjobsystems` R2 bucket. Values were not exposed. Zone Rulesets/Rate Limiting endpoints still return 403. |
| Database | VERIFIED: existing ignored local connection works for SELECT. Schema/constraints/indexes and aggregate counts captured; no applicant PII exported. 131 total jobs, 95 publicly listed, 3 applications, 0 password accounts at inspection. |
| GitHub | NOT VERIFIED: local `gh` is not authenticated. Repository remote known; hosted Actions results and secret configuration not accessible through that CLI. |
| Resend | PARTIALLY VERIFIED: the stored live key reads the Resend account and reports `payservice.top` verified with DKIM/SPF records verified. A read-only history check found two delivered and six bounced prior messages; the configured `swiftjob.payservice.top` HR/Reply-To subdomain has no MX record. A designated owner mailbox and controlled current receipt remain required. |
| R2 | PARTIALLY VERIFIED: account bucket listing succeeds; active binding points to swiftjobsystems. Local upload behavior can be simulated. Production object lifecycle not exercised. |
| Backblaze | NOT VERIFIED: binding names exist; actual private MSI content, signing and download behavior not exercised. No installer was executed. |
| Render | NOT VERIFIED / apparently retired: current README and proxy use Workers. No active Render service verified. |

Current public domain is `swiftjob.payservice.top`; Pages project is `swiftjob-systems`, Worker is `swiftjob-workers-api`. The repaired Worker and Pages deployments are live. The latest Pages deployment is `ea1dd1de.swiftjob-systems.pages.dev`; the active Worker version remains `9a65de17-bc8f-41f5-b151-6e6603b695bd`. Production Worker secret names are `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`, `EMAIL_FROM`, `HR_EMAIL`, `JWT_SECRET` and `RESEND_API_KEY`; optional `SUPPORT_EMAIL` and `TURNSTILE_SECRET_KEY` are not configured. The retired Backblaze/MSI path has been removed from active configuration and code, and its unused `B2_APP_KEY`/`B2_KEY_ID` bindings are absent from the current Worker.

History scan examined 1,137 Git objects and flagged credential-shaped database URLs in historical text. Values are deliberately excluded. The current legacy migration helper now reads `DATABASE_URL` from the environment and contains no credential. Historical candidates still require operator classification and rotation. This regex scan does not prove all secrets are absent.

Remaining access needs are a designated test-mail receipt and a Cloudflare token with zone Rulesets/Rate Limiting permissions. The historical Supabase project has no usable management token in the local OpenCode configuration; its old pooler credential still requires owner-side rotation/revocation. No domain migration or historical credential rotation has been performed.
