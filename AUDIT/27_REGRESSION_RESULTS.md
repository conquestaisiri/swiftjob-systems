# Regression results

| Check | Result | Evidence |
|---|---|---|
| Worker typecheck | PASS | `pnpm exec tsc --noEmit` |
| SPA typecheck | PASS | `pnpm exec tsc -p tsconfig.json --noEmit` |
| Production Vite build | PASS | 323.18 kB initial JS / 229.49 kB CSS; route chunks emitted; ContactsAdmin remains the largest lazy chunk |
| Auth/session/JSON/rate-limit boundary | PASS (15 groups) | `AUDIT/evidence/auth-regression.json` |
| Application/file/data boundary | PASS (7 groups) | `AUDIT/evidence/application-regression.json` |
| Checker safety and retired MSI | PASS (2 groups) | `AUDIT/evidence/techcheck-regression.json` |
| Sitemap and API headers | PASS | live `public-baseline.json`; dynamic `/sitemap.xml` returned 100 valid URLs and `no-store` |
| Responsive browser matrix | PASS | `evidence/responsive-browser-errors.json`; 30 route/width samples, zero body overflow, zero browser console errors |
| Accessibility DOM checks | PASS (automated subset) | `evidence/accessibility-closure.json`; 27 controls labeled, no duplicate IDs/unnamed buttons/missing image alt |
| Performance bundle check | PASS (quality) | `evidence/performance-closure.json`; route-level chunks reduced initial JS; Core Web Vitals NOT VERIFIED |
| Live candidate/admin boundary checks | PASS (safe subset) | `evidence/live-workflow-boundaries.json`; public jobs, invalid application, protected reads, invalid admin login and malformed contact |
| Real provider email receipt | NOT VERIFIED | designated mailbox access required |
| Production deploy of this branch | PASS (boundary) | Worker `36fbe614-498d-4a06-b101-3949954dd8da`; Pages `653a0fbd.swiftjob-systems.pages.dev`; live domain smoke checks |

The runtime checks use synthetic people, database, R2, and email recipients. They prove application behavior in isolation and do not prove production delivery. Live checks prove the deployed public boundary, headers, protected-route responses, dynamic sitemap and proxy behavior; they do not replace a real inbox receipt, DNS authentication check, historical credential rotation, or an edge-distributed rate-limit rule.
