import { jobService } from "./jobs";
import { campaignRepository, type CampaignWithStats } from "../repositories";
import type { Campaign } from "../schema";

export const campaignService = {
  async listWithStats(): Promise<CampaignWithStats[]> {
    return campaignRepository.listWithStats();
  },

  async getPublic(slug: string) {
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
    return campaignRepository.remove(id);
  },
};
