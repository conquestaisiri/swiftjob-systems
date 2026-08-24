-- SwiftJob - marketing campaigns
-- Adds ads/marketing campaign management: a campaign defines a per-campaign
-- landing page (/campaign/:slug) with ad-match messaging, a destination job,
-- and UTM metadata. Visits and CTA clicks are recorded per campaign so the
-- admin can see which ad placements drive traffic. Applications submitted
-- from a campaign page are attributed with the campaign slug for conversion
-- reporting.

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  channel text NOT NULL DEFAULT 'organic',
  utm_source text,
  job_slug text,
  headline text NOT NULL,
  subheadline text NOT NULL DEFAULT '',
  cta_label text NOT NULL DEFAULT 'Apply now',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per visit to a campaign landing page. clicked_cta marks visits that
-- converted to a click on the page's primary CTA.
CREATE TABLE IF NOT EXISTS campaign_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  device text NOT NULL DEFAULT 'unknown',
  clicked_cta boolean NOT NULL DEFAULT false,
  user_agent text,
  visited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_visits_campaign_id
  ON campaign_visits (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_visits_visited_at
  ON campaign_visits (visited_at DESC);

-- Attribution: which campaign (if any) produced an application.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS campaign_slug text;

CREATE INDEX IF NOT EXISTS idx_applications_campaign_slug
  ON applications (campaign_slug);

-- Admin-set display counter for the "recently hired" activity popups.
-- Blank means the popups show live application counts automatically.
INSERT INTO referral_content (key, body) VALUES ('hiresAggregateDisplay', '')
ON CONFLICT (key) DO NOTHING;