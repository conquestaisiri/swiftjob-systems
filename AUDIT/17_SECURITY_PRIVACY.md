# Security and privacy review

Repairs include strict candidate ownership, session revocation, JWT algorithm/claim checks, rate-limit buckets that do not reset per referral code, safe storage filenames, signature validation, private/no-store resume responses, reference-bound assessments, API response hardening headers, no full URL logging, and removal of silent third-party background requests.

The combined MSI route is retired. Standard checkers collect basic specs only, do not bypass PowerShell execution policy, do not include hostnames, and consume a one-time token. The history scan found credential-shaped database URLs in current/history objects; values were not emitted, and rotating any exposed historical credentials remains an operator task.
