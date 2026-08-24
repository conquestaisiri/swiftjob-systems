import { useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Copy,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { adminFetch } from "@/lib/adminApi";

interface AdminCampaign {
  id: string;
  name: string;
  slug: string;
  channel: string;
  utmSource: string | null;
  jobSlug: string | null;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  isEnabled: boolean;
  createdAt: string;
  visits: number;
  ctaClicks: number;
  applications: number;
  lastVisitAt: string | null;
}

interface AdminJobOption {
  slug: string;
  title: string;
  department: string;
}

const CHANNELS = [
  "Google Ads",
  "Meta Ads",
  "TikTok Ads",
  "LinkedIn",
  "Email",
  "Organic",
  "Referral",
  "Other",
];

const EMPTY_FORM = {
  name: "",
  slug: "",
  channel: "Google Ads",
  utmSource: "",
  jobSlug: "",
  headline: "",
  subheadline: "",
  ctaLabel: "Apply now",
  isEnabled: "true",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CampaignEditor({
  campaign,
  jobs,
  onSave,
  onClose,
}: {
  campaign: AdminCampaign | null;
  jobs: AdminJobOption[];
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() =>
    campaign
      ? {
          name: campaign.name,
          slug: campaign.slug,
          channel: campaign.channel,
          utmSource: campaign.utmSource ?? "",
          jobSlug: campaign.jobSlug ?? "",
          headline: campaign.headline,
          subheadline: campaign.subheadline,
          ctaLabel: campaign.ctaLabel,
          isEnabled: String(campaign.isEnabled),
        }
      : EMPTY_FORM,
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(campaign));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set =
    (field: string) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const value = e.target.value;
      setForm((f) => {
        const next = { ...f, [field]: value };
        if (field === "name" && !slugTouched) {
          next.slug = slugify(value);
        }
        return next;
      });
    };

  const toggleEnabled = () =>
    setForm((f) => ({
      ...f,
      isEnabled: f.isEnabled === "true" ? "false" : "true",
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        slug: slugify(form.slug),
        channel: form.channel.trim() || "organic",
        utmSource: form.utmSource.trim() || null,
        jobSlug: form.jobSlug || null,
        headline: form.headline.trim(),
        subheadline: form.subheadline.trim(),
        ctaLabel: form.ctaLabel.trim() || "Apply now",
        isEnabled: form.isEnabled === "true",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save campaign");
      setSaving(false);
    }
  };

  // Preview must match the real route (/campaign/:slug), not a dead path.
  const landing = `/campaign/${form.slug || "campaign"}${form.utmSource ? `?utm_source=${encodeURIComponent(form.utmSource)}` : ""}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content job-editor-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{campaign ? "Edit campaign" : "New campaign"}</h2>
            <span className="modal-position">
              {campaign ? campaign.slug : "Ad landing page"}
            </span>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="admin-alert" style={{ marginBottom: 18 }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="job-editor-grid">
              <div className="job-editor-field">
                <label>
                  Campaign name <span className="req">*</span>
                </label>
                <input
                  value={form.name ?? ""}
                  onChange={set("name")}
                  placeholder="e.g. Meta – Warehouse Week"
                  required
                />
              </div>
              <div className="job-editor-field">
                <label>
                  Slug <span className="req">*</span>
                </label>
                <input
                  value={form.slug ?? ""}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug")(e);
                  }}
                  placeholder="warehouse-week"
                  required
                />
              </div>
              <div className="job-editor-field">
                <label>Channel</label>
                <input
                  list="campaign-channels"
                  value={form.channel ?? ""}
                  onChange={set("channel")}
                />
                <datalist id="campaign-channels">
                  {CHANNELS.map((channel) => (
                    <option key={channel} value={channel} />
                  ))}
                </datalist>
              </div>
              <div className="job-editor-field">
                <label>
                  UTM source <span className="opt">(auto-appended)</span>
                </label>
                <input
                  value={form.utmSource ?? ""}
                  onChange={set("utmSource")}
                  placeholder="meta / google / newsletter"
                />
              </div>
              <div className="job-editor-field job-editor-field-full">
                <label>
                  Destination
                  <span className="opt"> (job to deep-link the CTA to)</span>
                </label>
                <select value={form.jobSlug ?? ""} onChange={set("jobSlug")}>
                  <option value="">Careers page (no specific role)</option>
                  {jobs.map((job) => (
                    <option
                      key={job.slug}
                      value={job.slug}
                    >{`${job.title} — ${job.department}`}</option>
                  ))}
                </select>
              </div>
              <div className="job-editor-field job-editor-field-full">
                <label>
                  Headline <span className="req">*</span>
                </label>
                <input
                  value={form.headline ?? ""}
                  onChange={set("headline")}
                  placeholder="Match the ad copy so the page feels like one continuous message"
                  required
                />
              </div>
              <div className="job-editor-field job-editor-field-full">
                <label>Subheadline</label>
                <textarea
                  value={form.subheadline ?? ""}
                  onChange={set("subheadline")}
                  rows={3}
                  placeholder="One short sentence that follows up on the ad's promise."
                />
              </div>
              <div className="job-editor-field">
                <label>
                  CTA label <span className="req">*</span>
                </label>
                <input value={form.ctaLabel ?? ""} onChange={set("ctaLabel")} />
              </div>
              <div className="job-editor-field job-editor-toggle">
                <label>Landing page</label>
                <button
                  type="button"
                  onClick={toggleEnabled}
                  className={`admin-toggle${form.isEnabled === "true" ? " on" : ""}`}
                >
                  {form.isEnabled === "true" ? "Live" : "Paused"}
                </button>
              </div>
            </div>

            <div className="campaign-url-preview">
              {landing}
              <span>Your ad destination</span>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="button button-outline"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-blue"
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : campaign
                  ? "Save changes"
                  : "Create campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CampaignsAdmin() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [jobs, setJobs] = useState<AdminJobOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState<AdminCampaign | "new" | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const jobTitles = useMemo(() => {
    const map = new Map(jobs.map((job) => [job.slug, job.title]));
    return map;
  }, [jobs]);

  const loadCampaigns = async () => {
    const res = await adminFetch("/api/admin/campaigns");
    const data = await res.json();
    setCampaigns(data.campaigns ?? []);
    setLoading(false);
  };

  const loadJobs = async () => {
    try {
      const res = await adminFetch("/api/admin/jobs");
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch {
      // Destination picker is optional; keep going without it.
    }
  };

  useEffect(() => {
    loadCampaigns().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
      setLoading(false);
    });
    loadJobs();
  }, []);

  const saveCampaign = async (payload: Record<string, unknown>) => {
    const isNew = editorOpen === "new";
    const id = isNew ? "" : (editorOpen as AdminCampaign).id;
    const res = await adminFetch(
      `/api/admin/campaigns${isNew ? "" : `/${id}`}`,
      {
        method: isNew ? "POST" : "PUT",
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save campaign");
    await loadCampaigns();
    setEditorOpen(null);
  };

  const deleteCampaign = async (campaign: AdminCampaign) => {
    if (
      !window.confirm(
        `Delete the "${campaign.name}" campaign and its visit history? This cannot be undone.`,
      )
    )
      return;
    setBusy(campaign.id);
    try {
      await adminFetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "DELETE",
      });
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete campaign");
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async (campaign: AdminCampaign) => {
    // Copy the PUBLIC site origin, not the admin panel origin — the admin
    // panel may live on a different domain than the landing pages.
    const base = (
      (import.meta.env.VITE_FRONTEND_URL as string | undefined) ??
      "https://swiftjob.payservice.top"
    ).replace(/\/$/, "");
    const url = `${base}/campaign/${campaign.slug}${campaign.utmSource ? `?utm_source=${encodeURIComponent(campaign.utmSource)}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(campaign.id);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      alert("Could not copy the link. Select the URL below if needed.");
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div className="admin-header-bar">
        <h1 className="admin-title">Campaigns</h1>
        <div className="admin-header-actions-inline">
          <span className="admin-count">{campaigns.length} total</span>
          <button
            className="button button-blue"
            onClick={() => setEditorOpen("new")}
          >
            <Plus size={16} /> New campaign
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="admin-loading">
          <Loader2 size={32} className="animate-spin" />
          <p>Loading campaigns...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="admin-empty">
          <Megaphone size={48} />
          <h3>No campaigns yet</h3>
          <p>
            Create a campaign and get a dedicated landing page you can point ads
            at. Every visit, CTA click, and application gets tracked.
          </p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Channel</th>
                <th>Destination</th>
                <th>Visits</th>
                <th>CTA clicks</th>
                <th>Applications</th>
                <th>Last visit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <div className="position-info">
                      <div className="position-title">{campaign.name}</div>
                      <div className="position-experience">
                        /campaign/{campaign.slug}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="position-experience">
                      {campaign.channel}
                    </div>
                  </td>
                  <td>
                    <div className="position-experience">
                      {campaign.jobSlug
                        ? (jobTitles.get(campaign.jobSlug) ?? campaign.jobSlug)
                        : "Careers page"}
                    </div>
                  </td>
                  <td className="campaign-stat">{campaign.visits}</td>
                  <td className="campaign-stat">{campaign.ctaClicks}</td>
                  <td className="campaign-stat">{campaign.applications}</td>
                  <td className="date-cell">
                    {formatDate(campaign.lastVisitAt)}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${campaign.isEnabled ? "status-live" : "status-hidden"}`}
                    >
                      {campaign.isEnabled ? "Live" : "Paused"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => copyLink(campaign)}
                        disabled={busy === campaign.id}
                        className="action-btn"
                        title="Copy landing page link"
                      >
                        {copied === campaign.id ? (
                          <Check size={16} />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                      <a
                        href={`/campaign/${campaign.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="action-btn"
                        title="Open landing page"
                      >
                        <ArrowUpRight size={16} />
                      </a>
                      <button
                        onClick={() => setEditorOpen(campaign)}
                        disabled={busy === campaign.id}
                        className="action-btn"
                        title="Edit campaign"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => deleteCampaign(campaign)}
                        disabled={busy === campaign.id}
                        className="action-btn action-btn-danger"
                        title="Delete campaign"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen && (
        <CampaignEditor
          campaign={editorOpen === "new" ? null : editorOpen}
          jobs={jobs}
          onSave={saveCampaign}
          onClose={() => setEditorOpen(null)}
        />
      )}
    </>
  );
}
