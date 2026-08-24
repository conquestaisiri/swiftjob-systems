import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import {
  fetchCampaign,
  recordCampaignVisit,
  type CampaignJob,
  type PublicCampaign,
} from "@/lib/campaignApi";
import { trackEvent } from "@/lib/tracking";
import { SiteFooter } from "@/components/site/SiteFooter";

export function CampaignLanding() {
  const [location] = useLocation();
  const slug = location.replace("/campaign/", "").replace(/\/$/, "");
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [job, setJob] = useState<CampaignJob | null>(null);
  const [loading, setLoading] = useState(true);
  const recorded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCampaign(slug)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setCampaign(null);
          return;
        }
        setCampaign(data.campaign);
        setJob(data.job);
        document.title = `${data.campaign.headline} — SwiftJob`;
        trackEvent("view_content", {
          campaign: data.campaign.slug,
          channel: data.campaign.channel,
        });
      })
      .catch(() => {
        if (!cancelled) setCampaign(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    if (!recorded.current) {
      recorded.current = true;
      // One plain visit per browser session per campaign — SPA remounts and
      // back-navigation must not inflate visit counts. CTA clicks (below)
      // are distinct events and always record.
      const dedupeKey = `sj_campaign_visit_${slug}`;
      try {
        if (!sessionStorage.getItem(dedupeKey)) {
          sessionStorage.setItem(dedupeKey, "1");
          recordCampaignVisit(slug, false);
        }
      } catch {
        recordCampaignVisit(slug, false);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const destinationUrl = () => {
    const base = job ? `/careers/${job.slug}` : "/careers";
    const params = new URLSearchParams();
    if (campaign?.utmSource) params.set("utm_source", campaign.utmSource);
    params.set("campaign", slug);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };

  const handleCta = () => {
    recordCampaignVisit(slug, true);
    trackEvent("lead", { campaign: slug, channel: campaign?.channel });
  };

  if (loading) {
    return (
      <div className="campaign-shell">
        <header className="campaign-header">
          <Link href="/" className="landing-v2-brand">
            <img src="/swiftjob-mark.svg" alt="SwiftJob" />
            <span>SwiftJob</span>
          </Link>
        </header>
        <main className="campaign-main">
          <Loader2
            size={36}
            className="spin"
            style={{ margin: "120px auto 0" }}
          />
          <p className="campaign-loading">Loading…</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="campaign-shell">
        <header className="campaign-header">
          <Link href="/" className="landing-v2-brand">
            <img src="/swiftjob-mark.svg" alt="SwiftJob" />
            <span>SwiftJob</span>
          </Link>
        </header>
        <main className="campaign-main campaign-missing">
          <div>
            <h1>This opportunity is no longer available</h1>
            <p>
              The page you reached has been closed. You can still browse the
              open roles on the SwiftJob careers page.
            </p>
            <Link
              href="/careers"
              className="landing-v2-button landing-v2-button-dark"
            >
              Browse open roles <ArrowRight size={16} />
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="campaign-shell">
      <header className="campaign-header">
        <Link href="/" className="landing-v2-brand">
          <img src="/swiftjob-mark.svg" alt="SwiftJob" />
          <span>SwiftJob</span>
        </Link>
      </header>

      <main className="campaign-main">
        <section className="campaign-hero">
          <span className="campaign-eyebrow">
            <i />
            {campaign.channel
              ? `${campaign.channel} opportunity`
              : "SwiftJob opportunity"}
          </span>
          <h1>{campaign.headline}</h1>
          {campaign.subheadline && <p>{campaign.subheadline}</p>}

          {job && (
            <div className="campaign-job-card">
              <div>
                <span>{job.department}</span>
                <strong>{job.title}</strong>
              </div>
              <small>Remote · Flexible · Full training & support</small>
            </div>
          )}

          <a
            href={destinationUrl()}
            onClick={handleCta}
            className="campaign-cta"
          >
            {campaign.ctaLabel} <ArrowRight size={18} />
          </a>

          <div className="campaign-trustline">
            <ShieldCheck size={15} />
            <span>
              Free to apply · No recruitment fees · Your details stay private
            </span>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
