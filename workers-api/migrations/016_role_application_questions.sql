-- Role-specific prompts are configured on each job. Submitted answers are
-- stored with their prompt text so later edits do not alter old applications.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS application_questions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS role_answers jsonb NOT NULL DEFAULT '[]'::jsonb;
