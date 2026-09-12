# Email baseline and current verification

The active provider is Resend. Shared email layout uses green/cream brand colors, absolute site/logo links and escaped interpolated text. `EMAIL_FROM` supplies From; SUPPORT_EMAIL, then HR_EMAIL, supplies Reply-To. Templates are in `workers-api/src/services/email.ts`.

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

Sending retries all errors up to three times with 500/1000 ms delays. The shared send function now includes a plain-text alternative and reports successful sends truthfully. Provider acceptance is logged as “sent”; actual receipt is not proved, and persistent outbox/webhook delivery state remains outside this repair.

All local captures use `@example.test` recipients; the harness rejects other recipients and all unexpected outbound requests. Captured HTML is a rendering artifact, not proof of real delivery. No production test emails have been sent. Inbox/spam placement, SPF/DKIM/DMARC pass results, bounce handling and real response-address receipt remain NOT VERIFIED.

Required repair verification: HTML/text parity, safe links and escaping, independent HR/candidate failure paths, retry classification/idempotency, truthful operator status, every actual product event, desktop/mobile rendering and designated real mailbox receipt.
