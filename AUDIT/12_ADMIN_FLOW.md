# Admin flow

The admin shell provides navigation for overview, applications, referrals, contacts, jobs, campaigns, mail, activity, and settings. Empty states are present in the isolated preview. The mobile shell is now full-width with a scrollable navigation strip, avoiding the earlier fixed-sidebar overflow.

Admin tokens are issued only after configured credentials and an optional Turnstile check. Verification pins HS256, requires a normalized email, accepts only admin/HR roles, and requires an expiry. Candidate tokens cannot call admin endpoints. Isolated admin/auth mutation boundaries pass; live checks covered protected-route denial and public reads, while real admin mutations and email receipt remain unverified.
