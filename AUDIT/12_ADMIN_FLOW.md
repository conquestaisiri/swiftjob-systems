# Admin flow

The admin shell provides navigation for overview, applications, referrals, contacts, jobs, campaigns, mail, activity, and settings. Empty states are present in the isolated preview. The mobile shell is now full-width with a scrollable navigation strip, avoiding the earlier fixed-sidebar overflow.

Admin tokens are issued only after configured credentials and an optional Turnstile check. Verification pins HS256, requires a normalized email, accepts only admin/HR roles, and requires an expiry. Candidate tokens cannot call admin endpoints. Isolated admin/auth mutation boundaries pass; live checks covered protected-route denial and public reads, and one controlled production status mutation returned 200 with a Resend `delivered` candidate notification. The designated owner mailbox now visibly receives the cache-busted supplied-logo verification message. Broader admin mutation coverage remains unverified.
