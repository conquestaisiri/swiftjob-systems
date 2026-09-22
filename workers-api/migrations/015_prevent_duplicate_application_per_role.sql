-- A candidate should have one application per role.
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_email_job_slug
  ON applications (lower(email), job_slug)
  WHERE job_slug IS NOT NULL;
