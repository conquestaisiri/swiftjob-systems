-- SwiftJob - footprints & activities
-- Closes the schema drift where these two tables only existed via runtime
-- self-healing DDL (workers-api/src/services/referrals.ts). Fresh databases
-- provisioned from migrations alone now include them.
-- Mirrors the runtime DDL exactly; both are idempotent.

CREATE TABLE IF NOT EXISTS footprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  event text NOT NULL,
  device text NOT NULL DEFAULT 'unknown',
  user_agent text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS footprints_subject_idx
  ON footprints (subject_type, subject_id, created_at DESC);
ALTER TABLE footprints ADD COLUMN IF NOT EXISTS meta jsonb;

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  target_email text,
  detail jsonb,
  status text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activities_created_idx ON activities (created_at DESC);
CREATE INDEX IF NOT EXISTS activities_action_idx ON activities (action);
