-- SwiftJob - referral system schema drift fix
-- Brings the referrals table up to date with the Drizzle schema in
-- workers-api/src/schema.ts and adds the referral_clicks table that was
-- previously only created at runtime. This makes fresh deployments from
-- migrations fully reproducible (no reliance on runtime self-healing).

-- Add columns that the schema defines but migration 004 did not create.
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS zip_code text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS last_clicked_at timestamptz;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS last_device text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS content_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Click tracking table (was runtime-created only).
CREATE TABLE IF NOT EXISTS referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  device_type text NOT NULL DEFAULT 'unknown',
  clicked_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the queries the referral service actually runs.
CREATE INDEX IF NOT EXISTS idx_referrals_email ON referrals (email);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_by ON referrals (referred_by);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals (status);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referral_id ON referral_clicks (referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_clicked_at ON referral_clicks (clicked_at DESC);
