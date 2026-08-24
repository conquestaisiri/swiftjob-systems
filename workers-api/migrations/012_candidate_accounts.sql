-- SwiftJob - candidate password accounts
-- Optional password sign-in alongside magic links. Magic links remain the
-- password-reset path and continue to work on their own.

CREATE TABLE IF NOT EXISTS candidate_accounts (
  email text PRIMARY KEY,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
