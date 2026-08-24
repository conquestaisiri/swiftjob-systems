-- SwiftJob - role-matched assessments
-- One row per candidate assessment. A computer-based role gets an assessment
-- after the application is submitted: a system-requirements check plus
-- questions matched to the role track (office / technical / analytical /
-- creative). Scores are computed from the MCQ answers; written answers are
-- kept for human review by the hiring team.

CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  job_slug text NOT NULL,
  track text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  system_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  score int,
  max_score int,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_application
  ON assessments (application_id);
CREATE INDEX IF NOT EXISTS idx_assessments_job_slug
  ON assessments (job_slug);

-- Data repair: the actuary compensation string was seeded with a corrupted
-- character. Match any "$3,000…" variant that is not already correct so the
-- repair actually fires regardless of how the dash was mangled.
UPDATE jobs
SET compensation = '$3,000–$6,500/month'
WHERE slug = 'actuary' AND compensation LIKE '$3,000%' AND compensation <> '$3,000–$6,500/month';
