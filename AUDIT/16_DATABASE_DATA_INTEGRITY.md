# Database and data integrity

The connected baseline read Neon without mutation: 131 jobs, 95 public jobs, three existing applications, zero password accounts, and no duplicate lower(trim(email))+position groups in the checked set. Existing tables include applications, assessments, candidate accounts, sessions, jobs, referrals, campaigns, contacts, and activity records.

The repair binds applications to an active job slug, preserves campaign attribution, validates files before persistence, removes an uploaded orphan if the insert fails, exposes a reduced candidate view, and persists an `Idempotency-Key` with a unique partial index. A replay returns the original application without another write or email in the isolated test.

Schema closure is recorded in `evidence/schema-closure.json`. Migrations `001` through `013` are present, and the additive idempotency migration is applied. Request-time `CREATE TABLE`, `ALTER TABLE` and `CREATE INDEX` self-healing has been removed from campaign, assessment, referral and tech-check services. A read-only `information_schema` guard now runs once per Worker isolate and returns a clear 503 when the required migration state is missing; migration execution is the production deployment contract.
