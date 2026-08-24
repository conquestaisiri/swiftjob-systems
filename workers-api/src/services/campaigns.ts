import { neon } from "@neondatabase/serverless";
import { getEnv } from "../config";
import { jobService } from "./jobs";
import { campaignRepository, type CampaignWithStats } from "../repositories";
import type { Campaign } from "../schema";

// Idempotent campaign schema (mirrors migrations/008_campaigns.sql). Runs
// once per Worker isolate as a safety net — the same pattern as referrals.
const CAMPAIGN_SCHEMA_SQL = `
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
CREATE TABLE IF NOT EXISTS campaign_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  device text NOT NULL DEFAULT 'unknown',
  clicked_cta boolean NOT NULL DEFAULT false,
  user_agent text,
  visited_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_visits_campaign_id ON campaign_visits (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_visits_visited_at ON campaign_visits (visited_at DESC);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS campaign_slug text;
CREATE INDEX IF NOT EXISTS idx_applications_campaign_slug ON applications (campaign_slug);
INSERT INTO referral_content (key, body) VALUES ('employedSoFarDisplay', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO referral_content (key, body) VALUES ('countriesDisplay', '') ON CONFLICT (key) DO NOTHING;
`;

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

async function runCampaignSchema(): Promise<void> {
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }
  const sql = neon(DATABASE_URL);
  for (const statement of CAMPAIGN_SCHEMA_SQL.split(";")) {
    const trimmed = statement.trim();
    if (trimmed) {
      await sql(trimmed);
    }
  }
}

export function ensureCampaignSchemaOnce(): Promise<void> {
  if (schemaEnsured) return Promise.resolve();
  if (!schemaPromise) {
    schemaPromise = runCampaignSchema().then(() => {
      schemaEnsured = true;
    });
  }
  return schemaPromise;
}

export const campaignService = {
  async listWithStats(): Promise<CampaignWithStats[]> {
    await ensureCampaignSchemaOnce();
    return campaignRepository.listWithStats();
  },

  async getPublic(slug: string) {
    await ensureCampaignSchemaOnce();
    const campaign = await campaignRepository.findPublicBySlug(slug);
    if (!campaign) return null;
    let job: { slug: string; title: string; department: string } | null = null;
    if (campaign.jobSlug) {
      const jobRecord = await jobService.getBySlug(campaign.jobSlug);
      if (jobRecord) {
        job = {
          slug: jobRecord.slug,
          title: jobRecord.title,
          department: jobRecord.department,
        };
      }
    }
    return { campaign, job };
  },

  async recordVisit(input: {
    slug: string;
    device: string;
    clickedCta: boolean;
    userAgent?: string;
  }) {
    await ensureCampaignSchemaOnce();
    const campaign = await campaignRepository.findPublicBySlug(input.slug);
    if (!campaign) return false;
    await campaignRepository.recordVisit({
      campaignId: campaign.id,
      device: input.device,
      clickedCta: input.clickedCta,
      userAgent: input.userAgent,
    });
    return true;
  },

  async create(input: {
    name: string;
    slug: string;
    channel: string;
    utmSource: string | null;
    jobSlug: string | null;
    headline: string;
    subheadline: string;
    ctaLabel: string;
    isEnabled: boolean;
  }): Promise<Campaign> {
    await ensureCampaignSchemaOnce();
    if (await campaignRepository.findBySlug(input.slug)) {
      throw new Error("A campaign with this slug already exists");
    }
    return campaignRepository.create({
      ...input,
      utmSource: input.utmSource,
    });
  },

  async update(
    id: string,
    patch: {
      name: string;
      slug: string;
      channel: string;
      utmSource: string | null;
      jobSlug: string | null;
      headline: string;
      subheadline: string;
      ctaLabel: string;
      isEnabled: boolean;
    },
  ): Promise<Campaign | null> {
    await ensureCampaignSchemaOnce();
    // Pre-check the slug like create() does so a duplicate surfaces as a
    // clean 409 instead of a raw Postgres unique-violation 500.
    const existing = await campaignRepository.findBySlug(patch.slug);
    if (existing && existing.id !== id) {
      throw new Error("A campaign with this slug already exists");
    }
    const updated = await campaignRepository.update(id, patch);
    return updated ?? null;
  },

  async remove(id: string): Promise<boolean> {
    await ensureCampaignSchemaOnce();
    return campaignRepository.remove(id);
  },
};
