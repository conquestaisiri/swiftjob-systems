# Performance review

The production Vite build succeeds. Route-level lazy loading was added after the baseline showed a single approximately 1.16 MB JavaScript chunk. The current initial `index` chunk is approximately 323.18 kB (104.75 kB gzip), CSS is 229.73 kB (40.68 kB gzip), and candidate/admin pages load separate route chunks. The largest remaining lazy chunk is ContactsAdmin at approximately 352.20 kB (120.07 kB gzip), so further splitting should follow profiling rather than guesswork.

Live HTTP baseline after the current Worker deployment recorded `/api/healthz` 1,434 ms, `/api/jobs` 996 ms, `/sitemap.xml` 673 ms and protected 401 boundaries between 180–779 ms. Core Web Vitals were not measured because the available browser sandbox does not expose the Performance API and Chrome DevTools MCP is unavailable; LCP, INP and CLS therefore remain NOT VERIFIED. Full evidence is in `evidence/performance-closure.json`.
