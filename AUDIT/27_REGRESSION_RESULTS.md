# Regression results

| Check | Result | Evidence |
|---|---|---|
| Worker typecheck | PASS | `pnpm exec tsc --noEmit` |
| SPA typecheck | PASS | `pnpm exec tsc -p tsconfig.json --noEmit` |
| Production Vite build | PASS | 1,159.67 kB JS / 229.49 kB CSS; large-chunk warning recorded |
| Auth/session/JSON boundary | PASS (14 groups) | `AUDIT/evidence/auth-regression.json` |
| Application/file/data boundary | PASS (7 groups) | `AUDIT/evidence/application-regression.json` |
| Checker safety and retired MSI | PASS (2 groups) | `AUDIT/evidence/techcheck-regression.json` |
| Local sitemap and API headers | PASS | local preview HTTP checks |
| Mobile admin overflow | PASS | local DOM width measurement |
| Real provider email receipt | NOT VERIFIED | designated mailbox access required |
| Production deploy of this branch | PASS (boundary) | Worker `f7c23cf7-9984-4361-9223-27565a718e3a`; Pages `86efbe61.swiftjob-systems.pages.dev`; live domain smoke checks |

The runtime checks use synthetic people, database, R2, and email recipients. They prove application behavior in isolation and do not prove production delivery. Live checks prove the deployed public boundary, headers, protected-route responses and proxy CORS; they do not replace a real inbox receipt or DNS authentication check.
