# Route inventory

Source: `evidence/active-api-routes.json`, `artifacts/swiftjob-systems/src/App.tsx`, and the Worker route table. The active product is a React/Vite Pages SPA behind a Hono Worker API.

Public SPA routes include `/`, `/login`, `/login/confirm`, `/careers`, `/careers/:slug`, `/careers/apply/success`, `/assessment`, `/privacy`, `/terms`, `/referral/:code`, and `/campaign/:slug`. Candidate routes are `/candidate/applications` and its detail/resume/footprint operations. Admin routes cover login, overview, applications, jobs, referrals, campaigns, contacts, mail, settings, and activity.

The Worker inventory records 76 API registrations (including middleware). Public mutations are rate-limited. Candidate mutations require the shared `swiftjob_session` Bearer or HttpOnly cookie and a database session. Admin mutations require an expiring HS256 JWT with an admin or HR role. The retired background-load and combined-installer paths return 410.

Evidence limits: route presence and source authorization are VERIFIED; representative live boundary checks pass, while full live mutation coverage and real provider delivery remain unverified.
