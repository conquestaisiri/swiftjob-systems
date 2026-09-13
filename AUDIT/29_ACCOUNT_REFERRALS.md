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

## Live browser verification

- A controlled candidate session signed in through the production magic-link
  flow and loaded the Applications, Profile, and Referrals pages.
- Desktop and 390px mobile layouts were visually inspected; navigation, logo,
  reward cards, form fields, and empty states rendered cleanly.
- The session created both a general referral link and a role-specific
  Captioner / Subtitler link. The role-specific link showed the expected $40
  reward and the public handoff resolved to the correct job with its `ref`
  attribution parameter.
- Temporary candidate data, session, and referral links were removed after the
  check.

## Remaining production coverage

- The authorized owner mailbox still needs an inbox-placement check for the
  complete magic-link, application, and referral email sequence.
- Hire verification and payout settlement remain explicit admin/business
  actions; this change records pending and paid states but does not move money.
- The broader production review still tracks historical credential rotation,
  Core Web Vitals/DevTools measurement, full screen-reader review, and
  fine-grained edge-rule verification as separate gates.
