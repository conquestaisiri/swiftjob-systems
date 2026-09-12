# Candidate flow

Apply: the active job is resolved server-side from `jobSlug`; closed/unknown jobs, missing resumes, oversized files, mismatched extensions, and invalid signatures return client errors before a write. A valid PDF stores once, sends one HR and one applicant confirmation in the synthetic sink, and issues the email-link path.

Access: magic links are atomic one-use tokens. Password setup requires a verified candidate session and derives the email from that session. Password and magic-link sessions share the same signed token/cookie contract; logout revokes the database session before clearing the cookie.

Portal: candidate responses select safe fields, enforce ownership, and omit private room data until Shortlisted. Assessment GET/POST requires email plus application reference. Resume downloads are private attachments. Isolated auth and application regressions pass.
