# Notifications and events

Application creation emits one HR notification, one applicant confirmation, and one candidate access email through the shared Resend service. Email sends retry three times with backoff; failures are logged and do not falsely report success. A plain-text alternative is now supplied alongside every generated HTML message.

Status, referral, contact, and admin-mail events are inventoried in `14_EMAIL_SYSTEM.md` and the route inventory. The synthetic mailbox captures expected recipient, subject, HTML, and text. Provider acceptance, inbox placement, bounce handling, and real HR receipt are not verified in this branch.
