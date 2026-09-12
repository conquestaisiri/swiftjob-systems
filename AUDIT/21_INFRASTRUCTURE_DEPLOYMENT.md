# Infrastructure and deployment

The active deployment is Cloudflare Pages (`swiftjob-systems`) with a Pages Function proxying to the Hono Worker (`swiftjob-workers-api`), Neon PostgreSQL, R2, and Resend. The former private B2/combined MSI path is retired. Provider inventory confirmed access and recorded deployment metadata without emitting secrets.

CI now installs pnpm explicitly, uses boolean `allowBuilds` values for `sharp` and `workerd`, runs frozen installs, and fails when a required Worker secret is absent. Worker and Pages deploy jobs remain separate. The Worker deployment currently serving production is version `f7c23cf7-9984-4361-9223-27565a718e3a`; the Pages production deployment is `86efbe61.swiftjob-systems.pages.dev` under project `swiftjob-systems`. The existing custom domain `https://swiftjob.payservice.top` is live.

Post-deploy checks: `/api/healthz` and `/api/jobs` return 200 with security headers and `no-store`; protected candidate/admin routes reject anonymous access; invalid assessment references return 404; the retired MSI endpoint returns 410; the Pages preflight reflects the same-origin and allows `Idempotency-Key`; `/sitemap.xml` returns XML with 100 URLs. Migration `013_application_idempotency.sql` was applied additively and existing job/application counts were unchanged.
