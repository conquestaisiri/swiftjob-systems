import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  UsersRound,
  Link2,
  Copy,
  Send,
  Eye,
  Gauge,
  CheckCircle2,
  MousePointerClick,
  RotateCcw,
  History,
  Mail,
} from "lucide-react";
import { handleAdminUnauthorized, isUnauthorized } from "@/lib/adminAuth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const FRONTEND_BASE =
  (import.meta.env.VITE_FRONTEND_URL as string | undefined) ??
  "https://swiftjob.payservice.top";

interface ReferralRow {
  id: string;
  referralCode: string;
  fullName: string;
  email: string | null;
  referredBy: string | null;
  jobTitle: string | null;
  meetingUrl: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  zipCode: string | null;
  source: string | null;
  notes: string | null;
  status: string;
  emailSentAt: string | null;
  clickCount: number;
  lastClickedAt: string | null;
  lastDevice: string | null;
  createdAt: string;
  updatedAt: string;
  footprint?: FootprintSummary | null;
}

interface FootprintSummary {
  visits: number;
  clicks: number;
  downloads: number;
  blocked: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  lastVisitDevice: string | null;
  lastClickAt: string | null;
  lastClickDevice: string | null;
  hesitant: boolean;
}

interface FootprintEvent {
  id: string;
  subjectType: string;
  subjectId: string;
  event: string;
  device: string;
  userAgent: string | null;
  createdAt: string;
}

interface SendStatus {
  dailyLimit: number;
  sentToday: number;
  remaining: number;
}

type ContentMap = Record<string, string>;

interface ContentField {
  key: string;
  label: string;
  group: "Page" | "Device gate" | "CTA & Support" | "Email" | "Next step";
  textarea?: boolean;
  hint?: string;
}

const CONTENT_FIELDS: ContentField[] = [
  { key: "heroTitle", label: "Hero title", group: "Page" },
  { key: "heroSubtitle", label: "Hero subtitle / kicker", group: "Page" },
  {
    key: "intro",
    label: "Intro paragraph",
    group: "Page",
    textarea: true,
    hint: "Supports {name}, {position}, {referredBy}",
  },
  { key: "aboutRoleTitle", label: "About the role — heading", group: "Page" },
  {
    key: "aboutRoleBody",
    label: "About the role — body",
    group: "Page",
    textarea: true,
  },
  {
    key: "roleMetaTitle",
    label: "What to expect — heading",
    group: "Page",
  },
  {
    key: "roleMetaBody",
    label: "What to expect — body",
    group: "Page",
    textarea: true,
  },
  {
    key: "whatYouDoTitle",
    label: "What you will be doing — heading",
    group: "Page",
  },
  {
    key: "whatYouDoBody",
    label: "What you will be doing — body",
    group: "Page",
    textarea: true,
  },
  { key: "payTitle", label: "Pay & earnings — heading", group: "Page" },
  {
    key: "payBody",
    label: "Pay & earnings — body",
    group: "Page",
    textarea: true,
  },
  { key: "howWorksTitle", label: "How it works — heading", group: "Page" },
  {
    key: "howWorksBody",
    label: "How it works — body",
    group: "Page",
    textarea: true,
  },
  {
    key: "getStartedTitle",
    label: "Your next step — heading",
    group: "Page",
  },
  {
    key: "getStartedBody",
    label: "Your next step — body",
    group: "Page",
    textarea: true,
  },
  {
    key: "workshopTitle",
    label: "About your workshop — heading",
    group: "Page",
  },
  {
    key: "workshopBody",
    label: "About your workshop — body",
    group: "Page",
    textarea: true,
  },
  {
    key: "companyTitle",
    label: "About SwiftJob — heading",
    group: "Page",
  },
  {
    key: "companyBody",
    label: "About SwiftJob — body",
    group: "Page",
    textarea: true,
  },
  { key: "workTypeLabel", label: "Work type label", group: "Page" },
  {
    key: "sidebarLaptopNote",
    label: "Sidebar laptop note",
    group: "Page",
    hint: "Shown under the clock icon in the sidebar",
  },
  {
    key: "gateTitle",
    label: "Device gate — title",
    group: "Device gate",
  },
  {
    key: "gateSubtitle",
    label: "Device gate — subtitle",
    group: "Device gate",
  },
  {
    key: "gateDetected",
    label: 'Device gate — "viewing on phone" line',
    group: "Device gate",
  },
  {
    key: "gateBody",
    label: "Device gate — body",
    group: "Device gate",
    textarea: true,
  },
  {
    key: "gateAction",
    label: "Device gate — action",
    group: "Device gate",
    textarea: true,
  },
  {
    key: "gateLaptopHelp",
    label: 'Device gate — "already on laptop" title',
    group: "Device gate",
  },
  {
    key: "gateLaptopHelpBody",
    label: "Device gate — laptop help body",
    group: "Device gate",
    textarea: true,
  },
  {
    key: "gateBackLabel",
    label: "Device gate — back button label",
    group: "Device gate",
  },
  {
    key: "securityNote",
    label: "Security note (below content)",
    group: "CTA & Support",
    textarea: true,
  },
  { key: "supportTitle", label: "Support — heading", group: "CTA & Support" },
  {
    key: "supportBody",
    label: "Support — body",
    group: "CTA & Support",
    textarea: true,
  },
  {
    key: "ctaLabel",
    label: "CTA button label",
    group: "CTA & Support",
    hint: "Button label on the referral page",
  },
  {
    key: "emailSubject",
    label: "Email — subject line",
    group: "Email",
    hint: "Supports {name}, {position}",
  },
  { key: "emailGreeting", label: "Email — greeting", group: "Email" },
  {
    key: "emailBody",
    label: "Email — body",
    group: "Email",
    textarea: true,
    hint: "Supports {name}, {position}",
  },
  { key: "emailCtaLabel", label: "Email — button label", group: "Email" },
  {
    key: "emailClosing",
    label: "Email — closing",
    group: "Email",
    textarea: true,
  },
];

const TABS = ["Page", "Device gate", "CTA & Support", "Email"] as const;
type ContentTab = (typeof TABS)[number];

function interpolatePreview(
  value: string,
  vars: { name: string; position: string },
): string {
  return value
    .replace(/\{name\}/gi, vars.name)
    .replace(/\{position\}/gi, vars.position)
    .replace(/\{code\}/gi, "SJ-XXXX-XXXX");
}

function publicLink(code: string): string {
  return `${FRONTEND_BASE.replace(/\/$/, "")}/referral/${code}`;
}

function ContentEditor({
  content,
  onSave,
  onClose,
  scope,
  onReset,
  seedReady = true,
}: {
  content: ContentMap;
  onSave: (content: ContentMap, opts: { applyToAll: boolean }) => Promise<void>;
  onClose: () => void;
  scope?: { type: "all" } | { type: "selected"; count: number };
  /** Reverts the selected referrals to the app-wide defaults (clears overrides). */
  onReset?: () => Promise<void>;
  /** False while the per-referral seed is still being fetched — saving before
   *  it lands would diff against the wrong baseline and clobber overrides. */
  seedReady?: boolean;
}) {
  const [draft, setDraft] = useState<ContentMap>(content);
  const [activeTab, setActiveTab] = useState<ContentTab>("Page");
  const [applyToAll, setApplyToAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const dirty = useRef(false);

  // The `content` source is fetched asynchronously by the parent. Sync the
  // draft whenever it arrives/changes, but never clobber edits the admin has
  // already made in this editor session.
  useEffect(() => {
    if (!dirty.current) setDraft(content);
  }, [content]);

  const handleDraftChange = (key: string, value: string): void => {
    dirty.current = true;
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const fields = CONTENT_FIELDS.filter((f) => f.group === activeTab);
  const isSelected = scope?.type === "selected";

  const save = async () => {
    if (!seedReady) return; // never diff against a not-yet-loaded baseline
    setError("");
    setSaving(true);
    try {
      await onSave(draft, { applyToAll: isSelected ? applyToAll : true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save content");
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!onReset) return;
    // The parent handler owns the single confirmation dialog — no double ask.
    setError("");
    setResetting(true);
    try {
      await onReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revert content");
      setResetting(false);
    }
  };

  const previewVars = { name: "Alex Morgan", position: "Virtual Assistant" };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content content-editor-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Referral page &amp; email editor</h2>
            <span className="modal-position">
              {isSelected
                ? `Editing ${scope.count} selected referral${scope.count === 1 ? "" : "s"}`
                : "Live site defaults (all referrals)"}
            </span>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {error && (
            <div className="admin-alert" style={{ marginBottom: 18 }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          {isSelected && (
            <div className="scope-toggle-row">
              <label className="scope-toggle">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                />
                <span>
                  <strong>Also apply these changes to ALL referrals</strong>
                </span>
              </label>
              <p>
                Checked: your edits are ALSO written onto every existing
                referral as overrides. Leave unchecked (default) to apply only
                to the {scope.count} selected — everyone else keeps following
                the global defaults.
              </p>
            </div>
          )}
          {fields.map((field) => (
            <div
              className="job-editor-field job-editor-field-full"
              key={field.key}
            >
              <label>
                {field.label}
                {field.hint && <span className="opt"> — {field.hint}</span>}
              </label>
              {field.textarea ? (
                <textarea
                  value={draft[field.key] ?? ""}
                  onChange={(e) => handleDraftChange(field.key, e.target.value)}
                  rows={
                    field.key.includes("Body") ||
                    field.key.includes("emailBody") ||
                    field.key.includes("intro") ||
                    field.key.includes("gate")
                      ? 6
                      : 3
                  }
                />
              ) : (
                <input
                  value={draft[field.key] ?? ""}
                  onChange={(e) => handleDraftChange(field.key, e.target.value)}
                />
              )}
            </div>
          ))}
          {activeTab !== "Email" && (
            <div className="shortlist-preview" style={{ marginTop: 8 }}>
              <div className="shortlist-preview-head">
                <Eye size={15} /> Preview — what a referral sees
              </div>
              <div className="shortlist-preview-body">
                <h4>
                  {interpolatePreview(
                    draft.heroTitle || "You've been referred",
                    previewVars,
                  )}
                </h4>
                <p
                  className="shortlist-preview-copy"
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {interpolatePreview(draft.intro || "", previewVars)}
                </p>
                <span className="shortlist-preview-link">
                  {draft.ctaLabel || "Continue to your next step"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-status-row">
            {isSelected && onReset && (
              <button
                type="button"
                disabled={resetting || saving}
                onClick={reset}
                className="button button-sm button-outline"
              >
                {resetting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                {resetting ? " Reverting…" : " Reset selected to defaults"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="button button-sm button-outline"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !seedReady}
              onClick={save}
              className="button button-blue"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : !seedReady ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {!seedReady
                ? " Loading current content…"
                : saving
                  ? " Saving…"
                  : isSelected && applyToAll
                    ? " Save & apply to all"
                    : isSelected
                      ? " Save & apply to selected"
                      : " Save content"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditReferralModal({
  row,
  jobOptions,
  onSave,
  onClose,
}: {
  row: ReferralRow;
  jobOptions: string[];
  onSave: (id: string, payload: Partial<ReferralRow>) => Promise<void>;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState(row.fullName);
  const [meetingUrl, setMeetingUrl] = useState(row.meetingUrl ?? "");
  const [jobTitle, setJobTitle] = useState(row.jobTitle ?? "");
  const [referredBy, setReferredBy] = useState(row.referredBy ?? "");
  const [phone, setPhone] = useState(row.phone ?? "");
  const [city, setCity] = useState(row.city ?? "");
  const [country, setCountry] = useState(row.country ?? "");
  const [address, setAddress] = useState(row.address ?? "");
  const [zipCode, setZipCode] = useState(row.zipCode ?? "");
  const [source, setSource] = useState(row.source ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave(row.id, {
        fullName: fullName.trim(),
        meetingUrl: meetingUrl.trim() || null,
        jobTitle: jobTitle.trim() || null,
        referredBy: referredBy.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        address: address.trim() || null,
        zipCode: zipCode.trim() || null,
        source: source.trim() || null,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content shortlist-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Edit {row.fullName}</h2>
            <span className="modal-position">{row.referralCode}</span>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="modal-body">
          <div className="modal-section">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={16} /> {error}
              </div>
            )}
            <div className="mb-4">
              <label className="admin-field-label">
                Full name <span className="req">*</span>
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="filter-input admin-input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="admin-field-label">
                Job / position <span className="opt">(optional)</span>
              </label>
              <input
                list="referral-job-options"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="filter-input admin-input"
                placeholder="e.g. Virtual Assistant"
              />
              <datalist id="referral-job-options">
                {jobOptions.map((j) => (
                  <option key={j} value={j} />
                ))}
              </datalist>
              <p className="text-xs text-slate-400 mt-1">
                Used in the email and page copy. Choose from an existing job or
                type a custom one.
              </p>
            </div>
            <div className="mb-4">
              <label className="admin-field-label">
                Room link <span className="opt">(optional)</span>
              </label>
              <input
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://…"
                className="filter-input admin-input"
              />
              <p className="text-xs text-slate-400 mt-1">
                This candidate's own room link. It is revealed after the Next
                step wait when no room link is set in the Next step editor. It
                is also used as the email's follow link.
              </p>
            </div>
            <div className="mb-4">
              <label className="admin-field-label">
                Referred by <span className="opt">(optional)</span>
              </label>
              <input
                value={referredBy}
                onChange={(e) => setReferredBy(e.target.value)}
                className="filter-input admin-input"
                placeholder="e.g. Tracy Miller"
              />
              <p className="text-xs text-slate-400 mt-1">
                The person's name shown on the page (e.g. "Referred by Tracy").
                Fill this in yourself per lead — it doesn't come from the
                spreadsheet.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="mb-1">
                <label className="admin-field-label">
                  Phone <span className="opt">(optional)</span>
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="filter-input admin-input"
                  placeholder="+1 555 000 0000"
                />
              </div>
              <div className="mb-1">
                <label className="admin-field-label">
                  City <span className="opt">(optional)</span>
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="filter-input admin-input"
                  placeholder="Pittsburgh"
                />
              </div>
              <div className="mb-1">
                <label className="admin-field-label">
                  Country / region <span className="opt">(optional)</span>
                </label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="filter-input admin-input"
                  placeholder="Arkansas"
                />
              </div>
              <div className="mb-1">
                <label className="admin-field-label">
                  ZIP / postcode <span className="opt">(optional)</span>
                </label>
                <input
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className="filter-input admin-input"
                  placeholder="15216"
                />
              </div>
              <div className="mb-1">
                <label className="admin-field-label">
                  Source <span className="opt">(optional)</span>
                </label>
                <input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="filter-input admin-input"
                  placeholder="CL-1"
                />
              </div>
              <div className="mb-1">
                <label className="admin-field-label">
                  Address <span className="opt">(optional)</span>
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="filter-input admin-input"
                  placeholder="129 Lucinda Drive"
                />
              </div>
            </div>
            <div className="mt-1 mb-4">
              <label className="admin-field-label">
                Notes <span className="opt">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="filter-input admin-input"
                rows={3}
                placeholder="Call notes, tags, anything else you want to keep for this lead."
              />
            </div>
          </div>
          <div className="modal-footer">
            <div className="modal-status-row">
              <button
                type="button"
                onClick={onClose}
                className="button button-sm button-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="button button-blue"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Pencil size={16} />
                )}
                {saving ? " Saving…" : " Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReferralsAdmin({ token }: { token: string }) {
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [footprintFilter, setFootprintFilter] = useState("");
  const [status, setStatus] = useState<SendStatus | null>(null);
  const [editing, setEditing] = useState<ReferralRow | null>(null);
  const [timelineFor, setTimelineFor] = useState<ReferralRow | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<FootprintEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [contentOpen, setContentOpen] = useState<
    { type: "all" } | { type: "selected"; ids: string[] } | null
  >(null);
  const [content, setContent] = useState<ContentMap>({});
  // Seed for the per-referral editor: the merged (global + overrides) content of
  // the first selected referral, so admins edit what the referral actually sees.
  const [editorSeed, setEditorSeed] = useState<ContentMap | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [batchCount, setBatchCount] = useState<string>("");
  const [deletingSelected, setDeletingSelected] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (footprintFilter) params.set("footprint", footprintFilter);
      const res = await fetch(`${API_BASE}/api/admin/referrals?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (isUnauthorized(res)) {
        handleAdminUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch referrals");
      setReferrals(data.referrals);
      setTotal(data.total);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referrals");
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, footprintFilter]);

  const loadStatusAndContent = useCallback(async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/referrals/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/admin/referrals/content`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (isUnauthorized(sRes) || isUnauthorized(cRes)) {
        handleAdminUnauthorized();
        return;
      }
      if (sRes.ok) {
        const s = await sRes.json();
        if (s?.status) setStatus(s.status);
      }
      if (cRes.ok) {
        const c = await cRes.json();
        if (c?.content) setContent(c.content);
      }
    } catch {
      /* secondary load — ignore */
    }
  }, [token]);

  useEffect(() => {
    loadStatusAndContent();
  }, [loadStatusAndContent]);

  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
  }, [load]);

  const jobOptions = useMemo(
    () =>
      [
        ...new Set(
          referrals.map((r) => r.jobTitle).filter(Boolean) as string[],
        ),
      ].sort(),
    [referrals],
  );

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Only non-"Sent" rows can be individually selected (their checkboxes are
  // disabled), so "select all" and the header state must be based on the
  // selectable rows rather than every row. Otherwise disabled rows leak into
  // `selected` and can only be cleared via the header.
  const selectableCount = useMemo(
    () => referrals.filter((r) => r.status !== "Sent").length,
    [referrals],
  );

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === selectableCount) return new Set();
      return new Set(
        referrals.filter((r) => r.status !== "Sent").map((r) => r.id),
      );
    });
  };

  const deleteReferral = async (row: ReferralRow) => {
    if (!window.confirm(`Delete ${row.fullName}? This cannot be undone.`))
      return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/referrals/${row.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete");
      setReferrals((prev) => prev.filter((r) => r.id !== row.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    if (
      !window.confirm(
        `Remove ${ids.length} selected referral${ids.length === 1 ? "" : "s"}? Their invite links stop working immediately. This cannot be undone.`,
      )
    )
      return;
    setDeletingSelected(true);
    try {
      let deleted = 0;
      for (const id of ids) {
        const res = await fetch(`${API_BASE}/api/admin/referrals/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isUnauthorized(res)) {
          handleAdminUnauthorized();
          return;
        }
        if (res.ok) deleted++;
      }
      setSelected(new Set());
      await load();
      await loadStatusAndContent();
      alert(`${deleted} referral${deleted === 1 ? "" : "s"} removed.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete referrals");
    } finally {
      setDeletingSelected(false);
    }
  };

  const editReferral = async (id: string, payload: Partial<ReferralRow>) => {
    const res = await fetch(`${API_BASE}/api/admin/referrals/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update");
    setReferrals((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...data.referral } : r)),
    );
    setEditing(null);
  };

  const openContentEditor = useCallback(
    async (ids: string[]) => {
      setContentOpen({ type: "selected", ids });
      setEditorSeed(null);
      // Seed the per-referral editor with the first referral's merged content so
      // the admin edits what that referral actually sees (its own overrides
      // layered over the global defaults), rather than the global defaults alone.
      const firstId = ids[0];
      if (!firstId) return;
      try {
        const res = await fetch(
          `${API_BASE}/api/admin/referrals/${encodeURIComponent(firstId)}/content`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (isUnauthorized(res)) {
          handleAdminUnauthorized();
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data?.content && typeof data.content === "object") {
            setEditorSeed(data.content);
          }
        }
      } catch {
        /* fall back to the global defaults as the seed */
      }
    },
    [token],
  );

  const saveContent = async (
    updated: ContentMap,
    opts: { applyToAll: boolean },
  ) => {
    const isBulk = contentOpen?.type === "selected";
    const ids = isBulk ? (contentOpen?.ids ?? []) : [];

    if (!isBulk) {
      // Default (all) scope — update the global live defaults wholesale.
      const res = await fetch(`${API_BASE}/api/admin/referrals/content`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: updated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save content");
      setContent(data.content);
      setContentOpen(null);
      setEditorSeed(null);
      return;
    }

    // Only persist fields the admin actually changed for this referral; the
    // global defaults (or any other per-referral overrides) stay untouched so
    // future global edits still apply.
    const changed: ContentMap = {};
    for (const [key, value] of Object.entries(updated)) {
      if (key === "hrEmail") continue;
      if ((editorSeed?.[key] ?? "") !== (value ?? "")) {
        changed[key] = value;
      }
    }
    // Nothing changed relative to what the referral already sees — skip the
    // request entirely instead of writing an empty override set.
    if (Object.keys(changed).length === 0) {
      window.alert(
        "No changes detected — the content already matches what this referral sees. Nothing was applied.",
      );
      setContentOpen(null);
      setEditorSeed(null);
      setSelected(new Set());
      return;
    }

    // Apply the changed keys to the selected referrals (as per-referral
    // overrides), optionally layering them onto every referral as well.
    const res = await fetch(`${API_BASE}/api/admin/referrals/content/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content: changed,
        ids,
        applyToAll: opts.applyToAll,
      }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        data.error ||
          (opts.applyToAll
            ? "Failed to apply content"
            : "Failed to apply content to selection"),
      );
    setContentOpen(null);
    setEditorSeed(null);
    setSelected(new Set());
  };

  const revertSelectedToDefaults = async (ids: string[] = [...selected]) => {
    if (!ids.length) return;
    if (
      !window.confirm(
        "Revert the selected referrals' custom page/email content back to the live defaults? This clears their per-referral overrides.",
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/referrals/content/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revert content");
      setSelected(new Set());
      if (contentOpen?.type === "selected") setContentOpen(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revert content");
      throw err;
    }
  };

  const sendSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    const max = status?.remaining ?? ids.length;
    const requested = batchCount.trim() ? Number(batchCount) : ids.length;
    const toSend = ids.slice(
      0,
      Math.min(
        Number.isFinite(requested) && requested > 0
          ? Math.floor(requested)
          : ids.length,
        max,
      ),
    );
    // Be honest up front: the daily limit silently truncates the selection.
    const notAttempted = ids.length - toSend.length;
    if (
      notAttempted > 0 &&
      !window.confirm(
        `Daily limit allows only ${toSend.length} of your ${ids.length} selected referrals today. Send the first ${toSend.length} now? The remaining ${notAttempted} will NOT be attempted.`,
      )
    ) {
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/referrals/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: toSend, count: toSend.length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setStatus(data.status);
      const failed = Array.isArray(data.failed) ? data.failed : [];
      alert(
        `Sent ${data.sent} of ${toSend.length} attempted.${failed.length ? `\n${failed.length} could not be sent (see failures in the list).` : ""}${notAttempted ? `\n${notAttempted} selected were NOT attempted — daily limit already reached. Re-select them tomorrow.` : ""}`,
      );
      setSelected(new Set());
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const copyLink = async (code: string) => {
    const url = publicLink(code);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy referral link:", url);
    }
  };

  const openTimeline = async (row: ReferralRow) => {
    setTimelineFor(row);
    setTimelineLoading(true);
    setTimelineEvents([]);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/footprints?subjectType=referral&subjectId=${row.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (isUnauthorized(res)) {
        handleAdminUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load timeline");
      setTimelineEvents(data.events ?? []);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load timeline");
    } finally {
      setTimelineLoading(false);
    }
  };

  const unsentCount = referrals.filter((r) => r.status !== "Sent").length;

  const footprintStats = useMemo(() => {
    const visited = referrals.filter(
      (r) => r.footprint && r.footprint.visits > 0,
    ).length;
    const clicked = referrals.filter(
      (r) => r.footprint && r.footprint.clicks > 0,
    ).length;
    const hesitant = referrals.filter((r) => r.footprint?.hesitant).length;
    const blocked = referrals.filter(
      (r) => r.footprint && r.footprint.blocked > 0,
    ).length;
    return { visited, clicked, hesitant, blocked };
  }, [referrals]);

  const footprintChips = [
    {
      key: "",
      label: "All",
      count: referrals.length,
    },
    { key: "visited", label: "Visited", count: footprintStats.visited },
    {
      key: "not_visited",
      label: "Not visited",
      count: referrals.length - footprintStats.visited,
    },
    { key: "clicked", label: "Clicked", count: footprintStats.clicked },
    { key: "hesitant", label: "Hesitant", count: footprintStats.hesitant },
    { key: "blocked", label: "Mobile blocked", count: footprintStats.blocked },
  ] as const;

  return (
    <>
      <div className="admin-header-bar">
        <h1 className="admin-title">Referrals</h1>
        <div className="admin-header-actions-inline">
          <span className="admin-count">{total} total</span>
          <button
            className="button button-outline button-sm"
            onClick={() => setContentOpen({ type: "all" })}
          >
            <Eye size={15} /> Edit page &amp; email
          </button>
        </div>
      </div>

      {status && (
        <div className="admin-status-strip">
          <span>
            <Gauge size={15} /> <strong>{status.remaining}</strong> of{" "}
            {status.dailyLimit} sends left today (sent {status.sentToday})
          </span>
        </div>
      )}

      <div className="admin-status-strip admin-stats-chips">
        {footprintChips.map((chip) => (
          <button
            key={chip.key}
            className={`stats-chip${footprintFilter === chip.key ? " active" : ""}`}
            onClick={() => {
              setFootprintFilter(chip.key === footprintFilter ? "" : chip.key);
            }}
            title={`Show referrals: ${chip.label}`}
          >
            <strong>{chip.count}</strong> {chip.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="admin-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-filters">
        <div className="filter-group">
          <div className="search-wrapper">
            <Link2 size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="filter-input"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Sent">Sent</option>
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="admin-selection-bar">
          <span>
            <strong>{selected.size}</strong> selected
            {status ? ` · up to ${status.remaining} can be sent today` : ""}
          </span>
          <div className="selection-bar-actions">
            <button
              onClick={() => openContentEditor([...selected])}
              className="button button-outline button-sm"
            >
              <Eye size={15} /> Edit page &amp; email
            </button>
            <button
              onClick={deleteSelected}
              disabled={deletingSelected}
              className="button button-outline button-sm admin-delete-selected"
            >
              {deletingSelected ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Trash2 size={15} />
              )}{" "}
              Delete selected
            </button>
            <input
              type="number"
              min={1}
              max={status?.remaining ?? undefined}
              value={batchCount}
              onChange={(e) => setBatchCount(e.target.value)}
              placeholder="Send first N"
              title="Optional: only send the first N selected referrals (capped by today's remaining limit)"
              className="filter-input batch-count-input"
              aria-label="Number of referrals to send in this batch"
            />
            <button
              onClick={sendSelected}
              disabled={sending}
              className="button button-blue button-sm"
            >
              {sending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}{" "}
              Send selected
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="admin-loading">
          <Loader2 size={32} className="animate-spin" />
          <p>Loading referrals...</p>
        </div>
      ) : referrals.length === 0 ? (
        <div className="admin-empty">
          <UsersRound size={48} />
          <h3>No referrals yet</h3>
          <p>
            Add contacts on the Contacts tab, then add them here as referrals.
          </p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={
                      selectableCount > 0 && selected.size === selectableCount
                    }
                    onChange={toggleAll}
                  />
                </th>
                <th>Referral</th>
                <th>Job</th>
                <th>Status</th>
                <th>Clicks</th>
                <th>Footprint</th>
                <th>Private link</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((row) => (
                <tr
                  key={row.id}
                  className={row.footprint?.hesitant ? "hesitant-row" : ""}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelected(row.id)}
                      disabled={row.status === "Sent"}
                    />
                  </td>
                  <td>
                    <div className="position-info">
                      <div className="position-title">{row.fullName}</div>
                      <div className="position-experience">
                        {row.email ?? "— no email"}
                        {row.phone ? (
                          <>
                            {" · "}
                            {row.phone}
                          </>
                        ) : null}
                        {row.city ? (
                          <>
                            {" · "}
                            {row.city}
                          </>
                        ) : null}
                        {row.referredBy ? (
                          <>
                            {" · "}
                            Referred by {row.referredBy}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="position-experience">
                      {row.jobTitle ?? "—"}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${row.status === "Sent" ? "status-live" : "status-pending"}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>
                    {row.clickCount > 0 ? (
                      <div className="click-info">
                        <MousePointerClick size={14} />
                        <div>
                          <strong>{row.clickCount}</strong>
                          <span>
                            {" "}
                            {row.lastDevice === "mobile"
                              ? "mobile"
                              : row.lastDevice
                                ? "PC/laptop"
                                : "clicks"}
                          </span>
                        </div>
                        {row.lastClickedAt && (
                          <div className="click-at">
                            {new Date(row.lastClickedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="position-experience">—</div>
                    )}
                  </td>
                  <td>
                    {row.footprint ? (
                      <div className="footprint-cell">
                        {row.footprint.visits > 0 ? (
                          <span className="footprint-line">
                            <span
                              className={`footprint-badge ${
                                row.footprint.hesitant
                                  ? "footprint-badge-hesitant"
                                  : "footprint-badge-visited"
                              }`}
                            >
                              {row.footprint.hesitant ? "⚠" : "✓"}{" "}
                              {row.footprint.visits} visit
                              {row.footprint.visits === 1 ? "" : "s"}
                              {row.footprint.lastVisitDevice &&
                                ` · ${row.footprint.lastVisitDevice}`}
                            </span>
                            {row.footprint.hesitant && (
                              <span className="footprint-hesitant-label">
                                Hesitant — no click yet
                              </span>
                            )}
                            {row.footprint.blocked > 0 && (
                              <span className="footprint-badge footprint-badge-blocked">
                                🔒 {row.footprint.blocked} mobile attempt
                                {row.footprint.blocked === 1 ? "" : "s"} blocked
                              </span>
                            )}
                            {row.footprint.clicks > 0 && (
                              <span className="footprint-badge footprint-badge-clicked">
                                {row.footprint.clicks} click
                                {row.footprint.clicks === 1 ? "" : "s"}
                                {row.footprint.lastClickDevice &&
                                  ` · ${row.footprint.lastClickDevice}`}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="footprint-badge footprint-badge-none">
                            Not visited
                          </span>
                        )}
                        <button
                          className="footprint-timeline-btn"
                          onClick={() => openTimeline(row)}
                        >
                          <History size={13} /> Timeline
                        </button>
                      </div>
                    ) : (
                      <span className="footprint-badge footprint-badge-none">
                        No activity
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="link-cell">
                      <span className="link-code">{row.referralCode}</span>
                      <button
                        className="action-btn"
                        onClick={() => copyLink(row.referralCode)}
                        title="Copy public link"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn"
                        onClick={() => setEditing(row)}
                        title="Edit referral details"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => openContentEditor([row.id])}
                        title="Edit this referral's page & email"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="action-btn action-btn-danger"
                        onClick={() => deleteReferral(row)}
                        title="Delete"
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

      {unsentCount > 0 &&
        selected.size === 0 &&
        !loading &&
        referrals.length > 0 && (
          <p className="text-sm text-slate-500" style={{ marginTop: 10 }}>
            Select referrals above and choose <strong>Send selected</strong> to
            email them in a batch. Sends are capped by today's limit.
          </p>
        )}

      {timelineFor && (
        <div className="modal-overlay" onClick={() => setTimelineFor(null)}>
          <div
            className="modal-content shortlist-modal footprint-timeline-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Footprint timeline — {timelineFor.fullName}</h2>
                <span className="modal-position">
                  {timelineFor.referralCode} · {timelineFor.email ?? "no email"}
                </span>
              </div>
              <button
                onClick={() => setTimelineFor(null)}
                className="modal-close"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            {timelineFor.email && (
              <div className="modal-body footprint-reachout">
                <a
                  href={`mailto:${timelineFor.email}?subject=${encodeURIComponent(
                    "Your SwiftJob briefing",
                  )}&body=${encodeURIComponent(
                    `Hi ${timelineFor.fullName},\n\nWe noticed you opened your SwiftJob briefing${
                      timelineFor.footprint?.hesitant
                        ? " but didn't continue to the next step yet"
                        : timelineFor.footprint?.blocked
                          ? " from a phone — the next step only works on a PC or laptop, so please open the link on a computer"
                          : ""
                    }. This is just a friendly nudge — happy to help if anything wasn't clear.\n\nBest regards,\nSwiftJob HR`,
                  )}`}
                  className="button button-sm button-outline"
                >
                  <Mail size={14} /> Reach out to{" "}
                  {timelineFor.fullName.split(" ")[0]}
                </a>
              </div>
            )}
            <div className="modal-body">
              {timelineLoading ? (
                <div className="admin-loading" style={{ padding: 30 }}>
                  <Loader2 size={28} className="animate-spin" />
                  <p>Loading timeline...</p>
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="admin-empty">
                  <History size={40} />
                  <p>No activity recorded yet for this referral.</p>
                </div>
              ) : (
                <div className="footprint-timeline">
                  {timelineEvents.map((ev) => (
                    <div className="footprint-timeline-item" key={ev.id}>
                      <div
                        className={`footprint-timeline-dot footprint-timeline-dot--${ev.event}`}
                      />
                      <div className="footprint-timeline-body">
                        <div className="footprint-timeline-head">
                          <strong>
                            {ev.event === "click"
                              ? "Clicked the button"
                              : ev.event === "proceed"
                                ? "Proceeded to next step"
                                : "Visited the page"}
                          </strong>
                          <span className="footprint-time">
                            {new Date(ev.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="footprint-timeline-meta">
                          Device detected:{" "}
                          <strong>
                            {ev.device === "mobile"
                              ? "📱 Mobile/tablet"
                              : "💻 PC/laptop"}
                          </strong>
                          {ev.userAgent && (
                            <span className="footprint-time">
                              {" "}
                              · UA: {ev.userAgent}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <div className="modal-status-row">
                <button
                  type="button"
                  onClick={() => setTimelineFor(null)}
                  className="button button-sm button-outline"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <EditReferralModal
          row={editing}
          jobOptions={jobOptions}
          onSave={editReferral}
          onClose={() => setEditing(null)}
        />
      )}

      {contentOpen && (
        <ContentEditor
          content={editorSeed ?? content}
          onSave={saveContent}
          onClose={() => {
            setContentOpen(null);
            setEditorSeed(null);
          }}
          scope={
            contentOpen.type === "selected"
              ? { type: "selected", count: contentOpen.ids.length }
              : { type: "all" }
          }
          seedReady={
            contentOpen.type === "selected" ? editorSeed !== null : true
          }
          onReset={
            contentOpen.type === "selected"
              ? () => revertSelectedToDefaults(contentOpen.ids)
              : undefined
          }
        />
      )}
    </>
  );
}
