-- Candidate profiles, account-owned referral links, and role-level rewards.
-- All additions are nullable/defaulted so existing applications and jobs remain valid.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS referral_reward_cents integer;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_referral_reward_cents_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_referral_reward_cents_check
  CHECK (referral_reward_cents IS NULL OR referral_reward_cents BETWEEN 4000 AND 10000);
UPDATE jobs
SET referral_reward_cents = CASE
  WHEN lower(experience_level) = 'senior' THEN 10000
  WHEN lower(experience_level) = 'mid-level' THEN 8000
  WHEN lower(experience_level) = 'entry-level' THEN 4000
  ELSE 6000
END
WHERE referral_reward_cents IS NULL;

ALTER TABLE applications ADD COLUMN IF NOT EXISTS referral_code text;
CREATE INDEX IF NOT EXISTS idx_applications_referral_code ON applications (referral_code);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  email text PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  phone text,
  country text,
  city text,
  timezone text,
  address text,
  linkedin_url text,
  portfolio_url text,
  headline text,
  skills text,
  experience_summary text,
  education text,
  resume_path text,
  resume_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  code text NOT NULL UNIQUE,
  job_slug text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidate_referral_links_owner
  ON candidate_referral_links (owner_email, created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  link_code text NOT NULL,
  referred_email text,
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  job_slug text,
  status text NOT NULL DEFAULT 'clicked',
  reward_cents integer NOT NULL CHECK (reward_cents BETWEEN 4000 AND 10000),
  payout_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidate_referrals_owner
  ON candidate_referrals (owner_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_referrals_application
  ON candidate_referrals (application_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_referrals_dedupe
  ON candidate_referrals (link_code, lower(referred_email), job_slug)
  WHERE referred_email IS NOT NULL;
