# Security and privacy review

Repairs include strict candidate ownership, session revocation, JWT algorithm/claim checks, rate-limit buckets that do not reset per referral code, safe storage filenames, signature validation, private/no-store resume responses, reference-bound assessments, API response hardening headers, no full URL logging, and removal of silent third-party background requests.

The combined MSI route is retired. Standard checkers collect basic specs only, do not bypass PowerShell execution policy, do not include hostnames, and consume a one-time token. The history scan found credential-shaped database URLs in current/history objects; values were not emitted, and rotating any exposed historical credentials remains an operator task.

The historical-secret classification is in `evidence/history-secrets.json`: an old Supabase pooler credential was present in retired Express history, was removed from the current tree, and has unknown provider-side validity because authentication was not attempted. The owner must rotate/revoke the Supabase project pooler/database password and confirm no remaining consumer before a READY gate.

The Worker secret inventory was rechecked after deployment. Only the active production set remains (`DATABASE_URL`, `RESEND_API_KEY`, sender/recipient settings, JWT and admin credentials); the unused legacy Backblaze key bindings were deleted.

Rate-limit evidence is in `evidence/rate-limit-analysis.json`. The Worker has named in-memory limits for API, applications, contact, magic link, candidate/admin login, password change, referral and campaign traffic; the regression test proves the 11th bad password attempt from one IP is rejected with 429 while another IP remains independent. Cloudflare distributed rules could not be read or changed with the available token (API authorization error 10000), so this remains a partial abuse-control verification until edge rules are configured.
