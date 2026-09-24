-- Record the first checker launch and cap installation/report completion at
-- ten minutes from the exact installer start. Existing tokens remain unstarted.
ALTER TABLE tech_check_tokens
  ADD COLUMN IF NOT EXISTS started_at timestamptz;
