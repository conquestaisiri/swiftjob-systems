# SwiftJob brand system

The owner-supplied lockup and mark are the canonical artwork for this release. The source files are retained in this folder as `source-swiftjob-lockup.png` and `source-swiftjob-mark.png`; the production copies use transparent crops of that artwork so its proportions and detail stay consistent in the site, browser icon, social preview, and mail.

## Production assets

- `artifacts/swiftjob-systems/public/swiftjob-mark.svg` — stable SVG delivery path for the supplied mark on light surfaces.
- `artifacts/swiftjob-systems/public/swiftjob-mark-light.svg` — supplied mark prepared for dark surfaces.
- `artifacts/swiftjob-systems/public/swiftjob-logo.svg` — stable SVG delivery path for the supplied horizontal lockup.
- `artifacts/swiftjob-systems/public/swiftjob-logo-light.svg` — supplied horizontal lockup prepared for dark surfaces.
- `artifacts/swiftjob-systems/public/swiftjob-mark.png` and `swiftjob-logo.png` — transparent PNG fallbacks used by the favicon, social metadata, and transactional email.

The SVG paths intentionally remain stable for existing page references and point to the optimized PNG artwork, while PNG delivery is used where mail clients and social crawlers require it. The wordmark is always spelled `SwiftJob` with a capital S and J.
