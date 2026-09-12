# Email baseline and current verification

The active provider is Resend. Shared email layout uses green/cream brand colors, the production `swiftjob-logo.png` lockup at an absolute site URL, and escaped interpolated text. `EMAIL_FROM` supplies From; SUPPORT_EMAIL, then HR_EMAIL, supplies Reply-To. Templates are in `workers-api/src/services/email.ts`.

| Event | Recipient | Trigger | Baseline verification |
|---|---|---|---|
| Contact request | HR_EMAIL | POST contact | Synthetic sink PASS; real receipt NOT VERIFIED |
| Magic link | Requested candidate email | POST auth/magic-link | Source reviewed; real receipt NOT VERIFIED |
| Application notification | HR_EMAIL | Successful application insert | VERIFIED only in synthetic email sink |
| Applicant confirmation | Applicant | Successful application insert | VERIFIED only in synthetic email sink |
| Status change | Applicant | Admin status change | Source reviewed; synthetic end-to-end simulation not exercised |
| Referral invitation | Selected referral | Admin send | Source reviewed; synthetic end-to-end simulation not exercised |
| Custom message | Selected explicit recipients | Admin mail | Source reviewed; synthetic end-to-end simulation not exercised |
| Referral click notification | HR_EMAIL | Referral click | Source reviewed; synthetic end-to-end simulation not exercised |

There is no independent employer authentication/billing email system. Password reset uses an email sign-in link; the authenticated optional-password interface is now present.

Sending retries all errors up to three times with 500/1000 ms delays. The shared send function now includes a plain-text alternative and reports successful sends truthfully. Provider acceptance is logged as “sent”; actual receipt is not proved. Resend currently reports zero configured webhooks, so application-level bounce/outbox processing remains outside this repair.

All local captures use `@example.test` recipients; the harness rejects other recipients and all unexpected outbound requests. Captured HTML is a rendering artifact, not proof of real delivery. One controlled direct-recipient Resend probe was sent without an application mutation and the provider reported `delivered`; inbox/spam placement was not inspected. A read-only Resend history inspection found eight prior messages: two delivered and six bounced; five bounces targeted the configured `@swiftjob.payservice.top` HR/notification or candidate-link domain after mail-server connection failures. Cloudflare DNS has no MX record for that Reply-To/HR subdomain, so inbound receipt is not currently reliable.

Required repair verification: HTML/text parity, safe links and escaping, independent HR/candidate failure paths, retry classification/idempotency, truthful operator status, every actual product event, desktop/mobile rendering and designated real mailbox receipt.

## Closure sprint status (2026-09-12)

The current read-only provider check is recorded in `evidence/email-dns-closure.json`. Resend reports the verified root domain `payservice.top` with DKIM and SPF checks verified. Cloudflare DNS contains the root SPF and DMARC records, the Resend DKIM record, and the provider return-path records; the configured sender domain is under the verified root. The configured `swiftjob.payservice.top` Reply-To/HR subdomain has no MX record, and the Resend history contains corresponding bounces. The DMARC policy remains `p=none`, so enforcement is intentionally not claimed.

The controlled probe is recorded in `evidence/email-dns-closure.json`. Synthetic email sink checks still pass for the exercised application and contact paths. A real mailbox test must still cover magic link, application confirmation/HR notification and one status-change message, including inbox/spam placement, links, Reply-To and provider event state. The Resend API key and sender authentication are verified, and one direct-recipient provider event is `delivered`; recipient routing for the HR/Reply-To subdomain and mailbox inspection remain NOT VERIFIED.

The unified SwiftJob logo closure is recorded in `evidence/branding-closure.json`. All inspected message templates now reference `https://swiftjob.payservice.top/swiftjob-logo.png`; the asset is live and returns `image/png` on the production custom domain. This verifies the template asset and rendering path only. It does not certify inbox receipt until an owner-controlled mailbox and working MX routing are supplied.
