# Access baseline

| Surface | Evidence and access status |
|---|---|
| Local repository/toolchain | VERIFIED: Node 24.14.1, pnpm 11.18.0, Git and Python available. |
| Cloudflare | VERIFIED: existing deploy and DNS tokens validate. Worker/Pages deployment metadata, binding secret names, R2 bucket names and zone metadata readable. Values were not exposed. |
| Database | VERIFIED: existing ignored local connection works for SELECT. Schema/constraints/indexes and aggregate counts captured; no applicant PII exported. 131 total jobs, 95 publicly listed, 3 applications, 0 password accounts at inspection. |
| GitHub | NOT VERIFIED: local `gh` is not authenticated. Repository remote known; hosted Actions results and secret configuration not accessible through that CLI. |
| Resend | PARTIALLY VERIFIED: production Worker has a RESEND_API_KEY binding name. No usable local key/provider dashboard session or designated recipient mailbox has yet been established. Real receipt, bounce/suppression state and authentication headers remain NOT VERIFIED. |
| R2 | PARTIALLY VERIFIED: account bucket listing succeeds; active binding points to swiftjobsystems. Local upload behavior can be simulated. Production object lifecycle not exercised. |
| Backblaze | NOT VERIFIED: binding names exist; actual private MSI content, signing and download behavior not exercised. No installer was executed. |
| Render | NOT VERIFIED / apparently retired: current README and proxy use Workers. No active Render service verified. |

Current public domain is `swiftjob.payservice.top`; Pages project is `swiftjob-systems`, Worker is `swiftjob-workers-api`. The repaired Worker and Pages deployments are live. Secret names missing from Worker include optional SUPPORT_EMAIL and TURNSTILE_SECRET_KEY. The retired Backblaze/MSI path has been removed from active configuration and code, and its unused `B2_APP_KEY`/`B2_KEY_ID` bindings were deleted from the Worker during hard-gate closure.

History scan examined 1,137 Git objects and flagged credential-shaped database URLs in historical text. Values are deliberately excluded. The current legacy migration helper now reads `DATABASE_URL` from the environment and contains no credential. Historical candidates still require operator classification and rotation. This regex scan does not prove all secrets are absent.

Remaining access needs will be narrowed to designated test-mail receipt, provider inspection and any deployment verification that cannot be completed with existing access. No domain migration or credential rotation has been performed.
