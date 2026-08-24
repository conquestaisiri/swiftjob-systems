-- SwiftJob - one-time Tech Checker tokens
-- Each candidate gets a single-use, short-lived token embedded in a generated
-- system-check tool. The tool reports hardware specs once, then the token is
-- consumed and the tool stops working for that session.

CREATE TABLE IF NOT EXISTS tech_check_tokens (
  token_hash text PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  report jsonb
);
CREATE INDEX IF NOT EXISTS idx_tech_check_app ON tech_check_tokens (application_id);
