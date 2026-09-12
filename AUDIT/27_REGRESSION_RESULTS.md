# Regression results

| Check | Result | Evidence |
|---|---|---|
| Worker typecheck | PASS | `pnpm exec tsc --noEmit` |
| SPA typecheck | PASS | `pnpm exec tsc -p tsconfig.json --noEmit` |
| Workspace typecheck | PASS | `pnpm run typecheck` (libraries, SPA, retired API artifact and scripts) |
| Workspace production build | PASS | `pnpm run build` (all buildable workspace packages) |
| Production Vite build | PASS | 323.18 kB initial JS / 229.73 kB CSS; route chunks emitted; ContactsAdmin remains the largest lazy chunk |
| Auth/session/JSON/rate-limit boundary | PASS (15 groups) | `AUDIT/evidence/auth-regression.json` |
| Application/file/data boundary | PASS (7 groups) | `AUDIT/evidence/application-regression.json` |
| Checker safety and retired MSI | PASS (2 groups) | `AUDIT/evidence/techcheck-regression.json` |
| Sitemap and API headers | PASS | live `public-baseline.json`; dynamic `/sitemap.xml` returned 100 valid URLs and `no-store` |
| Responsive browser matrix | PASS | `evidence/responsive-browser-errors.json`; 30 prior samples plus 12 fresh settled samples on the latest deployment, zero body overflow and zero site-origin console errors |
| Accessibility DOM and sampled contrast checks | PASS (automated subset) | `evidence/accessibility-closure.json`, `evidence/contrast-closure.json`; 27 controls labeled, no duplicate IDs/unnamed buttons/missing image alt, 0 sampled contrast failures |
| Unified SwiftJob logo assets and brand surfaces | PASS (live visual sample) | `evidence/branding-closure.json`; production SVG/PNG assets, favicon, light/dark surfaces, admin login and email template path verified on the custom domain |
| Performance bundle check | PASS (quality) | `evidence/performance-closure.json`; route-level chunks reduced initial JS; Core Web Vitals NOT VERIFIED |
| Live candidate/admin boundary checks | PASS (safe subset) | `evidence/live-workflow-boundaries.json`; public jobs, invalid application, protected reads, invalid admin login and malformed contact |
| Real provider email receipt | PASS for designated mailbox check / broader coverage partial | Production magic-link handler returned 200, Resend reported `delivered`, token verification/logout passed, direct-recipient and inbound `hr@swiftjob.payservice.top` probes returned `delivered`, and Cloudflare recorded the inbound probe as `Forwarded`. Controlled production contact, application, admin custom-mail, referral-invitation and referral-click flows also returned successful handlers and Resend `delivered` events; synthetic application/resume/referrals were deleted. The designated owner mailbox received the cache-busted supplied-logo message, which rendered at 1200×411 with plain text and Reply-To intact. Full inbox/spam and every historical message variant remain outside this single controlled receipt. |
| Cloudflare provider/resource verification | PASS | supplied account token reads Pages project, Worker secrets/versions and R2; zone token reads DNS; one active combined edge rule is dashboard-verified and live 429-tested for contact/admin-stats bursts; programmatic zone Rulesets/Rate Limiting reads remain permission-blocked |
| Static security headers | PASS | `evidence/live-provider-boundary.json`; Pages custom domain and latest deployment return `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` and `Permissions-Policy` |
| Hosted CI for this branch | PASS | GitHub Actions run `34703839923`; workspace typecheck, isolated workflow regressions and production frontend build passed. Production deploy jobs are intentionally gated to `main`. |
| Production deploy of this branch | PASS (boundary) | Worker active version `dca9cc2f-9c7f-43e6-a3e0-57e2e35bd94e`; latest Pages `e30419db.swiftjob-systems.pages.dev`; live domain smoke checks |

The runtime checks use synthetic people, database, R2, and email recipients. They prove application behavior in isolation and do not prove production delivery. Live checks prove the deployed public boundary, headers, protected-route responses, dynamic sitemap, proxy behavior and the active combined edge rule; the designated mailbox receipt now covers the cache-busted supplied-logo message. Historical credential rotation and fine-grained per-route edge policies remain open.
