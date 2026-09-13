# Account referral and profile closure

Date: 2026-09-13

## Implemented

- Added persistent candidate profiles keyed to the verified candidate email.
- Applications now seed or refresh the candidate profile with the submitted
  contact, location, links, skills, education, experience, and resume metadata.
- Added private candidate routes for profile editing and referral management.
- Added account-owned referral links (`SJREF-XXXXXXXX`) with a public handoff
  that exposes only the linked role and reward.
- Added referral attribution to applications with duplicate and self-referral
  protection.
- Added role-level rewards stored in cents and constrained to $40–$100.
  Existing roles are assigned: entry-level $40, mid-level $80, senior $100,
  and other roles $60. Admins can set the exact amount in the job editor.
- Added candidate dashboard totals for referrals, verified hires, pending
  rewards, and paid rewards. Payout remains an explicit admin/business action;
  no payment is claimed until the hire is verified.
- Refreshed referral email/page defaults and made the content seeding and exact
  legacy-copy upgrade hooks run when content is first requested.

## Verification

- Migration `014_candidate_referrals_and_rewards.sql`: 13/13 statements passed
  against the production Neon database.
- Database baseline after migration: 131 jobs, 3 existing applications, 0
  candidate password accounts, no duplicate application groups.
- Worker deployment succeeded as version `ea44deae-12f8-4365-adfb-b8c47ae952e3`.
- Live `/api/jobs` returned 200 and included role reward values.
- Live protected candidate referral endpoint returned 401 without a session;
  invalid public referral codes returned 404.
- Existing auth, application, and tech-check regression suites all passed.
- Frontend build and worker/frontend TypeScript checks passed.

## Remaining live check

The account-only referral dashboard needs a verified candidate session to test
the interactive create/copy flow. The public and protected access gates are
already validated; the next browser pass should use the authorized test mailbox
to complete one magic-link sign-in, create one temporary link, open it, and
submit a controlled application through it.
