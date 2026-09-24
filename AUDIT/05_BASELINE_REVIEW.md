# Forensic baseline review

This consolidated report covers visual/UX, responsive behavior, assets, copy/trust, candidate/employer/admin flows, forms, notifications, data, security/privacy, accessibility, SEO, performance and legacy scope. Dedicated architecture, access, route, role and email reports supplement it. This avoids repeating the same shared-component defect across twenty documents. Open verification requirements are retained in master findings.

## UI, responsive behavior and assets

Public home, careers, a Product Manager detail, candidate login, missing-token confirmation, missing-data assessment, application success, admin login, legal pages and unknown route were inspected. Public screenshots and DOM/layout metrics were captured at 1440, 1280, 768 and 390 CSS-pixel targets. No document overflow was measured in those public captures. Visually reviewed home mobile, job desktop, login mobile and assessment mobile. Rapid viewport changes produced some transitional/compositor screenshots; use the settled login capture for that page, and do not treat capture glitches as product defects. All screenshots have not yet been individually reviewed.

The existing cream/green/black presentation is broadly restrained and should be preserved. The mobile homepage heading occupies four lines but remains readable. Candidate login's Back link crowds its centered logo. Application details are long; apply buttons and section structure exist. The application form has six unlabeled select controls; careers filters have four more. Admin settings and other admin controls also expose unlabeled fields. Inline form errors are not consistently linked to controls or focused. Keyboard, contrast, reduced-motion and screen-reader regression remains required.

Local admin login and every admin section were navigated with synthetic credentials. Empty applications, referrals, contacts, campaigns and activity screens exist; jobs load the public vacancy fixtures. Mail supports explicit recipients, database pickers, referral invites and custom messages. Settings expose referral send limits, room defaults, installer/background URLs and editable headline counts. An attempted admin four-width screenshot loop was interrupted by viewport capture failure; the observed local viewport remained 582 pixels after a 390 request. Therefore full admin breakpoint coverage is NOT VERIFIED. Do not label those captures 390 without actual viewport evidence.

Homepage photos render; no broken images were measured in the initial public home inspection. Source placeholder client wordmarks are displayed as trusted customers despite comments instructing replacement with real names. Asset provenance and organization/client permission are not established. Do not invent replacement clients or testimonials. Preserve neutral contextual photographs where appropriate and remove unsupported endorsement presentation.

## Copy and trust

The site repeats 28/28+ countries and guarantees 100% remote roles despite support for hybrid/on-site filters and metadata advertising any arrangement. Those claims need verified facts or neutral rewording. Review times differ (3–5 vs 5–7 days). Success copy says no further action while presenting an assessment CTA, and another step promises “no interviews” despite interview/room fields. Careers describe skills checks as optional with no pass mark, but actual prechecks impose speed/typing requirements. Privacy says no software is installed while a Windows MSI installer is offered. A generic LinkedIn homepage is not a company profile. “1 months ago” appears on live job cards.

## Connected workflows and forms

Local reproduction confirms valid contact POST returns 400 due to recursive JSON parsing. Application POST accepts a nonexistent vacancy and missing CV and returns 201. It lets a caller claim another email, then public registration accepts the returned ID to set/overwrite that email's password. Password login returns 200 but its double-signed token fails portal validation with 401. The cookie name also differs from the middleware. Candidate UI sign-out does not call server revocation.

Job search and combined department/search filtering were exercised publicly (95 vacancies to one Product Manager result); card/detail title, arrangement and compensation match for that sample. Full all-job consistency, query/back/refresh persistence, pagination boundaries and debounced request races still need regression. Application API lacks authoritative active-job binding, duplicate/idempotency enforcement, trimmed bounded field validation and campaign attribution acceptance. R2 uploads occur before database insert without cleanup rollback. CV validation trusts MIME and optional presence; downloads use inline disposition and loosely sanitized original filenames. Deletion swallows object-storage errors before removing the database record.

Assessment error rendering is unreachable while payload is null, so invalid/missing links remain loading. Completed assessment ordering can discard a recorded result. Track selection depends on user-supplied job context. An “instant validation” function marks tool verification true after a delay without receipt of a machine report. Device detection hard-blocks touch devices and can misclassify touch laptops. Installer code bypasses downloaded-file safeguards; no installer was executed during audit.

Candidate application JSON spreads room/meeting fields even when nextStep is blank for non-shortlisted records. Background room preparation makes undisclosed external requests from browser and server, follows redirects and buffers responses without clear size/time limits. These are unnecessary privacy and request-boundary risks. Database-backed status decisions should govern publication; user-facing actions should disclose external navigation.

## Data, security and events

Live read-only schema inspection found 17 application-related tables, 131 jobs, 3 applications, 0 candidate password accounts and no current duplicate normalized email/position groups. Existing absence of duplicates does not enforce future uniqueness. Twelve migrations run successfully in local PostgreSQL after normalizing a UTF-8 BOM. SQL enum/schema evolution, request-time DDL and the migration runner's continue-after-error behavior need a release-safe strategy.

Private candidate/admin endpoints deny anonymous public probes. Candidate ownership uses database email matching; one-use magic token consumption is atomic and tokens are stored as hashes. Preserve these protections. Strengthen JWT claim validation and malformed-cookie handling; per-isolate rate limiting is not globally durable. Global mutable environment/client caching deserves request-isolation review before claiming safe multi-binding behavior. Public API responses lack several standard security headers, and sensitive responses need consistent no-store.

Database activities cover only selected admin operations; “all actions logged” is unsupported. Device footprints and technology reports collect more than the visible privacy description explains. Claimed 24-month retention has no verified scheduled enforcement. Real legal applicability cannot be proven from code. Reword factual implementation claims, document data categories/processors and retain a clear support/deletion route; do not claim legal certification.

## SEO, performance, infrastructure and legacy

Public sitemap.xml currently serves SPA HTML with status 200. Base metadata differs from live positioning. Protected/auth pages lack a verified noindex policy. Robots include managed Cloudflare bot directives but no clear application-route sitemap strategy. Per-job metadata and structured data require validation against actual listings.

Worker and frontend TypeScript checks pass. Production Vite build passes, but the main JavaScript bundle is 1,164.82 kB (330.44 kB gzip); CSS is 229.03 kB (40.51 kB gzip). Admin and spreadsheet code is eagerly imported into visitor routes. Build warns about large chunks and one tooltip sourcemap. These are build measurements, not Core Web Vitals.

Frozen pnpm install fails its final build-approval gate because workspace allowBuilds contains placeholder strings for sharp/workerd. CI assumes setup-node installs pnpm; it does not. Worker and Pages deployments can proceed independently; secrets are updated after publish with failures suppressed. Hosted CI outcomes are NOT VERIFIED without GitHub access. Cloudflare provider deployment metadata is available; production deploy, rollback, DNS mail authentication and object lifecycle remain later verification gates.

Repository scan records 45 legacy Strix/Bluepeak/Supabase/Render mentions and 38 current-domain occurrences. Classify each by active, retired compatibility, documentation or generated artifact before removal. No blanket deletion. Migration preparation must cover Worker FRONTEND_URL, proxy API_ORIGIN, frontend URL/contact configuration, email/logo/auth links, DNS and provider-domain verification without changing the current domain.

## Baseline limits

No production mutations, real test emails, installer execution, domain migration or credential rotation occurred. Local email capture and PostgreSQL simulation are clearly distinct from provider/inbox verification. Remaining deep persona/failure/permission checks belong to the controlled implementation and regression phases and must not be marked passed merely because source compiles.
