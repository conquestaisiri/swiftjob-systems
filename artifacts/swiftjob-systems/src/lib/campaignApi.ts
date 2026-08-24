export interface PublicCampaign {
  slug: string;
  channel: string;
  utmSource: string | null;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  jobSlug: string | null;
}

export interface CampaignJob {
  slug: string;
  title: string;
  department: string;
}

export async function fetchCampaign(
  slug: string,
): Promise<{ campaign: PublicCampaign; job: CampaignJob | null } | null> {
  const res = await fetch(`/api/campaigns/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function recordCampaignVisit(
  slug: string,
  clickedCta: boolean,
): Promise<void> {
  try {
    // keepalive lets the request survive page unload, so CTA clicks that
    // navigate straight to the careers page are no longer cancelled.
    await fetch(`/api/campaigns/${encodeURIComponent(slug)}/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clickedCta }),
      keepalive: true,
    });
  } catch {
    // Tracking is best-effort; never block the visitor.
  }
}

export interface PublicStats {
  openJobs: number;
  applicationsProcessed: number;
  countriesReached: number;
  employedSoFar?: string | null;
  countriesDisplay?: string | null;
}

export async function fetchPublicStats(): Promise<PublicStats | null> {
  try {
    const res = await fetch("/api/public-stats");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
