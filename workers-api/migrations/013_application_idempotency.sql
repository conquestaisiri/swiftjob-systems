-- Persisted replay key for application submissions. Nullable keeps existing
-- rows valid; new clients send a UUID in the Idempotency-Key header.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS submission_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_submission_key
  ON applications (submission_key)
  WHERE submission_key IS NOT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS job_slug text;
CREATE INDEX IF NOT EXISTS idx_applications_job_slug ON applications (job_slug);
