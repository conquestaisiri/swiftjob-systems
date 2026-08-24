import { useState, useEffect } from "react";
import {
  Search,
  Mail,
  Phone,
  MapPin,
  Globe,
  Linkedin,
  FileText,
  Eye,
  Trash2,
  Loader2,
  AlertCircle,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
  KeyRound,
  Link2,
  CheckCircle2,
  History,
} from "lucide-react";
import { format } from "date-fns";
import { parseDateOnly } from "@/lib/utils";
import { API_BASE } from "@/lib/adminApi";
import { handleAdminUnauthorized } from "@/lib/adminAuth";
import { TRACKS, type AssessmentTrack } from "@/lib/assessmentTracks";

const STATUS_COLORS: Record<string, string> = {
  New: "#6366f1",
  Reviewing: "#f59e0b",
  Shortlisted: "#10b981",
  Rejected: "#ef4444",
  Hired: "#22c55e",
};

const ASSESSMENT_STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  in_progress: "#f59e0b",
  new: "#94a3b8",
};

const STATUS_OPTIONS = ["New", "Reviewing", "Shortlisted", "Rejected", "Hired"];

interface Application {
  id: string;
  createdAt: string;
  position: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  timezone: string;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  yearsExperience: string;
  education: string;
  englishProficiency: string;
  noticePeriod: string;
  expectedSalary: string;
  earliestStartDate: string;
  skills: string;
  relevantExperience: string;
  coverLetter: string;
  resumePath: string | null;
  resumeFilename: string | null;
  status: string;
  meetLink: string | null;
  interviewInstructions: string | null;
  meetingKey: string | null;
  backgroundUrl: string | null;
  roomLink: string | null;
  nextStepDelay: number | null;
  footprint?: FootprintSummary | null;
  assessment?: AssessmentSummary | null;
}

interface AssessmentSummary {
  id: string;
  applicationId: string;
  jobSlug: string;
  track: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  completedAt: string | null;
  createdAt: string;
}

interface AssessmentDetail extends AssessmentSummary {
  systemCheck: Record<string, unknown>;
  responses: { mcq: Record<string, number>; scenario: string } | null;
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

const FOOTPRINT_FILTERS = [
  { value: "", label: "All footprint states" },
  { value: "visited", label: "Visited" },
  { value: "not_visited", label: "Not visited" },
  { value: "proceeded", label: "Proceeded to next step" },
  { value: "not_proceeded", label: "Visited but not proceeded" },
  { value: "hesitant", label: "Hesitant" },
  { value: "blocked", label: "Blocked on mobile" },
];

const EVENT_LABELS: Record<string, string> = {
  visit: "Visited portal",
  proceed: "Proceeded to next step",
  download: "Downloaded resume",
  blocked: "Blocked (mobile attempt)",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "#94a3b8";
  return (
    <span
      className="status-badge"
      style={{
        backgroundColor: `${color}1a`,
        color,
        borderColor: `${color}40`,
      }}
    >
      <span className="status-dot" style={{ backgroundColor: color }} />
      {status}
    </span>
  );
}

interface ApplicationsProps {
  token: string;
}

export function Applications({ token }: ApplicationsProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [footprintFilter, setFootprintFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [shortlistApp, setShortlistApp] = useState<Application | null>(null);
  const [timelineFor, setTimelineFor] = useState<Application | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<FootprintEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => setSearch(searchInput), 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, footprintFilter]);

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
        });
        if (statusFilter) params.set("status", statusFilter);
        if (search) params.set("search", search);
        if (footprintFilter) params.set("footprint", footprintFilter);

        const res = await fetch(
          `${API_BASE}/api/admin/applications?${params}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.status === 401) {
          handleAdminUnauthorized();
          return;
        }
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error || "Failed to load applications");
        setApplications(data.applications ?? []);
        // The API nests totals under `pagination` — read from there so the
        // header count and pager actually work.
        setTotal(data.pagination?.total ?? data.total ?? 0);
        setTotalPages(data.pagination?.totalPages ?? data.totalPages ?? 1);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load applications",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, [token, page, statusFilter, search, footprintFilter]);

  const handleStatusChange = async (
    appId: string,
    newStatus: string,
    opts?: {
      meetLink?: string | null;
      interviewInstructions?: string | null;
      meetingKey?: string | null;
      backgroundUrl?: string | null;
      roomLink?: string | null;
      nextStepDelay?: number | null;
      notifyCandidate?: boolean;
    },
  ) => {
    setUpdatingStatus(appId);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/applications/${appId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: newStatus,
            ...(opts?.meetLink !== undefined
              ? { meetLink: opts.meetLink }
              : {}),
            ...(opts?.interviewInstructions !== undefined
              ? { interviewInstructions: opts.interviewInstructions }
              : {}),
            ...(opts?.meetingKey !== undefined
              ? { meetingKey: opts.meetingKey }
              : {}),
            ...(opts?.backgroundUrl !== undefined
              ? { backgroundUrl: opts.backgroundUrl }
              : {}),
            ...(opts?.roomLink !== undefined
              ? { roomLink: opts.roomLink }
              : {}),
            ...(opts?.nextStepDelay !== undefined
              ? { nextStepDelay: opts.nextStepDelay }
              : {}),
            ...(opts?.notifyCandidate !== undefined
              ? { notifyCandidate: opts.notifyCandidate }
              : {}),
          }),
        },
      );

      if (!res.ok) throw new Error("Failed to update status");
      const data = await res.json();
      setApplications((prev) =>
        prev.map((a) =>
          a.id === appId
            ? {
                ...a,
                ...(data.application || {}),
              }
            : a,
        ),
      );
      setSelectedApp((prev) =>
        prev && prev.id === appId
          ? {
              ...prev,
              ...(data.application || {}),
            }
          : prev,
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const requestShortlist = (app: Application) => {
    setShortlistApp(app);
  };

  const handleDelete = async (app: Application) => {
    if (
      !window.confirm(
        `Delete the application from ${app.fullName}? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/applications/${app.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete application");
      setApplications((prev) => prev.filter((a) => a.id !== app.id));
      if (selectedApp?.id === app.id) setSelectedApp(null);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to delete application",
      );
    }
  };

  const openTimeline = async (app: Application) => {
    setTimelineFor(app);
    setTimelineLoading(true);
    setTimelineEvents([]);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/footprints?subjectType=candidate&subjectId=${app.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.status === 401) {
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

  return (
    <>
      <div className="admin-header-bar">
        <h1 className="admin-title">Applications</h1>
        <span className="admin-count">{total} total</span>
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
            <Search size={18} />
            <input
              type="search"
              placeholder="Search by name, email, position..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="filter-input"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={footprintFilter}
            onChange={(e) => {
              setFootprintFilter(e.target.value);
              setPage(1);
            }}
            className="filter-select"
            aria-label="Filter by footprint"
          >
            {FOOTPRINT_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">
          <Loader2 size={32} className="animate-spin" />
          <p>Loading applications...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="admin-empty">
          <FileText size={48} />
          <h3>No applications found</h3>
          <p>Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Position</th>
                  <th>Location</th>
                  <th>Applied</th>
                  <th>Status</th>
                  <th>Footprint</th>
                  <th>Skills Check</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div className="candidate-info">
                        <div className="candidate-name">{app.fullName}</div>
                        <div className="candidate-contact">
                          <a href={`mailto:${app.email}`}>
                            <Mail size={12} /> {app.email}
                          </a>
                          <a href={`tel:${app.phone}`}>
                            <Phone size={12} /> {app.phone}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="position-info">
                        <div className="position-title">{app.position}</div>
                        <div className="position-experience">
                          {app.yearsExperience}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="location-info">
                        <MapPin size={12} /> {app.city}, {app.country}
                        <br />
                        <Globe size={12} /> {app.timezone}
                      </div>
                    </td>
                    <td className="date-cell">
                      {format(new Date(app.createdAt), "MMM d, yyyy")}
                    </td>
                    <td>
                      <StatusBadge status={app.status} />
                    </td>
                    <td>
                      {app.footprint ? (
                        <div className="footprint-cell">
                          {app.footprint.visits > 0 ? (
                            <span className="footprint-line">
                              <span
                                className={`footprint-badge ${
                                  app.footprint.hesitant
                                    ? "footprint-badge-hesitant"
                                    : "footprint-badge-visited"
                                }`}
                              >
                                {app.footprint.hesitant ? "⚠" : "✓"}{" "}
                                {app.footprint.visits} visit
                                {app.footprint.visits === 1 ? "" : "s"}
                                {app.footprint.lastVisitDevice &&
                                  ` · ${app.footprint.lastVisitDevice}`}
                              </span>
                              {app.footprint.hesitant && (
                                <span className="footprint-hesitant-label">
                                  Hesitant — no proceed
                                </span>
                              )}
                              {app.footprint.clicks > 0 && (
                                <span className="footprint-badge footprint-badge-clicked">
                                  {app.footprint.clicks} proceed
                                  {app.footprint.clicks === 1 ? "" : "s"}
                                  {app.footprint.lastClickDevice &&
                                    ` · ${app.footprint.lastClickDevice}`}
                                </span>
                              )}
                              {app.footprint.downloads > 0 && (
                                <span className="footprint-badge footprint-badge-download">
                                  ↓ {app.footprint.downloads} resume download
                                  {app.footprint.downloads === 1 ? "" : "s"}
                                </span>
                              )}
                              {app.footprint.blocked > 0 && (
                                <span className="footprint-badge footprint-badge-blocked">
                                  🔒 {app.footprint.blocked} mobile attempt
                                  {app.footprint.blocked === 1 ? "" : "s"}{" "}
                                  blocked
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
                            onClick={() => openTimeline(app)}
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
                      {app.assessment ? (
                        <div className="assessment-cell">
                          <span
                            className={`assessment-badge assessment-badge-${app.assessment.status}`}
                          >
                            {app.assessment.status === "completed"
                              ? `✓ ${app.assessment.score ?? "–"}/${
                                  app.assessment.maxScore ?? "–"
                                }`
                              : app.assessment.status === "in_progress"
                                ? "In progress"
                                : "Not started"}
                          </span>
                          {app.assessment.track !== "none" && (
                            <span className="assessment-track-label">
                              {TRACKS[
                                app.assessment.track as Exclude<
                                  AssessmentTrack,
                                  "none"
                                >
                              ]?.title ?? app.assessment.track}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="assessment-badge assessment-badge-none">
                          —
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => setSelectedApp(app)}
                          className="action-btn"
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        {app.status === "Shortlisted" && (
                          <button
                            onClick={() => requestShortlist(app)}
                            className="action-btn action-btn-edit"
                            title="Edit shortlist details (link, key, instructions)"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        <select
                          value={app.status}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (next === "Shortlisted") {
                              requestShortlist(app);
                              e.target.value = app.status;
                            } else if (next === app.status) {
                              /* no change */
                            } else {
                              // Status changes email the candidate by default.
                              // A stray click must not fire a live rejection.
                              const warn =
                                next === "Rejected"
                                  ? `Set this application to Rejected and EMAIL the candidate a rejection notice?`
                                  : `Change status to "${next}" and EMAIL the candidate an update?`;
                              if (!window.confirm(warn)) {
                                e.target.value = app.status;
                                return;
                              }
                              handleStatusChange(app.id, next);
                            }
                          }}
                          disabled={updatingStatus === app.id}
                          className="status-select"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDelete(app)}
                          className="action-btn action-btn-danger"
                          title="Delete application"
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

          {totalPages > 1 && (
            <div className="admin-pagination">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="button button-sm button-outline"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="button button-sm button-outline"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {timelineFor && (
        <div className="modal-overlay" onClick={() => setTimelineFor(null)}>
          <div
            className="modal-content shortlist-modal footprint-timeline-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Candidate timeline — {timelineFor.fullName}</h2>
                <span className="modal-position">
                  {timelineFor.position} · {timelineFor.email}
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
            <div className="modal-body">
              {timelineLoading ? (
                <div className="admin-loading" style={{ padding: 30 }}>
                  <Loader2 size={28} className="animate-spin" />
                  <p>Loading timeline...</p>
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="admin-empty">
                  <History size={40} />
                  <p>No activity recorded yet for this candidate.</p>
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
                          <strong>{EVENT_LABELS[ev.event] || ev.event}</strong>
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
                <a
                  href={`mailto:${timelineFor.email}?subject=${encodeURIComponent(
                    "Your SwiftJob application",
                  )}&body=${encodeURIComponent(
                    `Hi ${timelineFor.fullName},\n\nWe noticed you've been engaging with your SwiftJob portal${
                      timelineFor.footprint?.hesitant
                        ? " but haven't opened your briefing yet"
                        : timelineFor.footprint?.blocked
                          ? " from a phone — please open it on a PC or laptop when you're ready"
                          : ""
                    }. Just checking in to make sure everything is working for you.\n\nBest regards,\nSwiftJob HR`,
                  )}`}
                  className="button button-sm button-outline"
                >
                  <Mail size={14} /> Reach out to{" "}
                  {timelineFor.fullName.split(" ")[0]}
                </a>
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

      {selectedApp && (
        <ApplicationModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onStatusChange={(status) => {
            if (status === "Shortlisted") {
              requestShortlist(selectedApp);
            } else {
              handleStatusChange(selectedApp.id, status);
            }
          }}
          onEditShortlist={() => {
            if (selectedApp) requestShortlist(selectedApp);
          }}
          onDelete={() => handleDelete(selectedApp)}
          token={token}
        />
      )}

      {shortlistApp && (
        <ShortlistModal
          application={shortlistApp}
          onClose={() => setShortlistApp(null)}
          onConfirm={(opts) => {
            handleStatusChange(shortlistApp.id, "Shortlisted", opts);
            setShortlistApp(null);
          }}
        />
      )}
    </>
  );
}

function ApplicationModal({
  application,
  onClose,
  onStatusChange,
  onEditShortlist,
  onDelete,
  token,
}: {
  application: Application;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onEditShortlist: () => void;
  onDelete: () => void;
  token: string;
}) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "details" | "resume" | "assessment"
  >("overview");
  const [downloading, setDownloading] = useState(false);
  const [assessmentDetail, setAssessmentDetail] =
    useState<AssessmentDetail | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setAssessmentLoading(true);
    setAssessmentError("");
    setAssessmentDetail(null);
    fetch(`${API_BASE}/api/admin/applications/${application.id}/assessment`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          handleAdminUnauthorized();
          return;
        }
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error || "Failed to load skills check");
        if (!cancelled) setAssessmentDetail(data.assessment ?? null);
      })
      .catch((err) => {
        if (!cancelled)
          setAssessmentError(
            err instanceof Error ? err.message : "Failed to load skills check",
          );
      })
      .finally(() => {
        if (!cancelled) setAssessmentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [application.id, token]);

  const handleDownloadResume = async () => {
    if (!application.resumePath) return;
    setDownloading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/applications/${application.id}/resume`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = application.resumeFilename || "resume.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download resume");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{application.fullName}</h2>
            <span className="modal-position">{application.position}</span>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={activeTab === "details" ? "active" : ""}
            onClick={() => setActiveTab("details")}
          >
            Details
          </button>
          <button
            className={activeTab === "resume" ? "active" : ""}
            onClick={() => setActiveTab("resume")}
          >
            Resume & Files
          </button>
          <button
            className={activeTab === "assessment" ? "active" : ""}
            onClick={() => setActiveTab("assessment")}
          >
            Skills Check
          </button>
        </div>

        <div className="modal-body">
          {activeTab === "overview" && (
            <div className="modal-section">
              <div className="info-grid">
                <div className="info-item">
                  <label>Email</label>
                  <a href={`mailto:${application.email}`}>
                    {application.email}
                  </a>
                </div>
                <div className="info-item">
                  <label>Phone</label>
                  <a href={`tel:${application.phone}`}>{application.phone}</a>
                </div>
                <div className="info-item">
                  <label>Location</label>
                  <span>
                    {application.city}, {application.country}
                  </span>
                </div>
                <div className="info-item">
                  <label>Timezone</label>
                  <span>{application.timezone}</span>
                </div>
                <div className="info-item">
                  <label>Experience</label>
                  <span>{application.yearsExperience}</span>
                </div>
                <div className="info-item">
                  <label>Education</label>
                  <span>{application.education}</span>
                </div>
                <div className="info-item">
                  <label>English</label>
                  <span>{application.englishProficiency}</span>
                </div>
                <div className="info-item">
                  <label>Notice Period</label>
                  <span>{application.noticePeriod}</span>
                </div>
                <div className="info-item">
                  <label>Expected Salary</label>
                  <span>{application.expectedSalary}</span>
                </div>
                <div className="info-item">
                  <label>Earliest Start</label>
                  <span>
                    {format(
                      parseDateOnly(application.earliestStartDate),
                      "MMM d, yyyy",
                    )}
                  </span>
                </div>
                {application.linkedinUrl && (
                  <div className="info-item">
                    <label>LinkedIn</label>
                    <a
                      href={application.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Linkedin size={14} /> View Profile
                    </a>
                  </div>
                )}
                {application.portfolioUrl && (
                  <div className="info-item">
                    <label>Portfolio</label>
                    <a
                      href={application.portfolioUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Globe size={14} /> View Portfolio
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "details" && (
            <div className="modal-section">
              <div className="detail-group">
                <h4>Skills</h4>
                <p className="detail-text">{application.skills}</p>
              </div>
              <div className="detail-group">
                <h4>Relevant Experience</h4>
                <p className="detail-text">{application.relevantExperience}</p>
              </div>
              <div className="detail-group">
                <h4>Cover Letter</h4>
                <p className="detail-text">{application.coverLetter}</p>
              </div>
            </div>
          )}

          {activeTab === "resume" && (
            <div className="modal-section">
              {application.resumeFilename ? (
                <div className="resume-info">
                  <FileText size={32} className="resume-icon" />
                  <div>
                    <h4>{application.resumeFilename}</h4>
                    <p className="text-slate-500">Uploaded with application</p>
                  </div>
                  <button
                    onClick={handleDownloadResume}
                    disabled={downloading}
                    className="button button-blue"
                  >
                    {downloading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    {downloading ? " Downloading..." : " Download Resume"}
                  </button>
                </div>
              ) : (
                <div className="no-resume">
                  <FileText size={48} className="text-slate-300" />
                  <h4>No resume uploaded</h4>
                  <p className="text-slate-500">
                    The candidate did not attach a resume file.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "assessment" && (
            <div className="modal-section">
              {assessmentLoading ? (
                <div className="admin-loading" style={{ padding: 30 }}>
                  <Loader2 size={28} className="animate-spin" />
                  <p>Loading skills check...</p>
                </div>
              ) : assessmentError ? (
                <div className="admin-alert">
                  <AlertCircle size={18} />
                  <span>{assessmentError}</span>
                </div>
              ) : !assessmentDetail ? (
                <div className="no-resume">
                  <FileText size={48} className="text-slate-300" />
                  <h4>No skills check submitted</h4>
                  <p className="text-slate-500">
                    The candidate has not completed their skills check yet.
                  </p>
                </div>
              ) : (
                <AssessmentDetailView detail={assessmentDetail} />
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-status-row">
            <select
              value={application.status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="status-select status-select-lg"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {application.status === "Shortlisted" && (
              <button
                onClick={onEditShortlist}
                className="button button-sm button-outline"
              >
                <Pencil size={14} /> Edit shortlist
              </button>
            )}
            <button
              onClick={onDelete}
              className="button button-sm button-outline modal-delete"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
          <span className="modal-applied">
            Applied {format(new Date(application.createdAt), "MMMM d, yyyy")}
          </span>
        </div>
      </div>
    </div>
  );
}

function AssessmentDetailView({ detail }: { detail: AssessmentDetail }) {
  const config =
    detail.track === "none"
      ? undefined
      : TRACKS[detail.track as Exclude<AssessmentTrack, "none">];
  const pct =
    detail.maxScore && detail.score !== null
      ? Math.round((detail.score / detail.maxScore) * 100)
      : null;

  return (
    <div className="assessment-detail">
      <div className="assessment-detail-head">
        <div>
          <h4>{config?.title ?? "Skills Check"}</h4>
          {config?.blurb && <p className="text-slate-500">{config.blurb}</p>}
        </div>
        <div className="assessment-score-box">
          <span className="assessment-score-value">
            {detail.score ?? "–"}/{detail.maxScore ?? "–"}
          </span>
          {pct !== null && <span className="assessment-score-pct">{pct}%</span>}
        </div>
      </div>
      <p className="assessment-meta">
        {detail.status === "completed" && detail.completedAt
          ? `Completed ${new Date(detail.completedAt).toLocaleString()}`
          : `Status: ${detail.status.replace("_", " ")}`}
        {detail.jobSlug ? ` · ${detail.jobSlug}` : ""}
      </p>

      {config && detail.responses ? (
        <>
          <h5>Multiple choice</h5>
          {config.questions.map((q) => {
            const picked = detail.responses?.mcq[q.id];
            return (
              <div className="assessment-question" key={q.id}>
                <p className="assessment-q-prompt">{q.prompt}</p>
                <div className="assessment-options">
                  {q.options.map((opt, i) => {
                    const isCorrect = i === q.correctIndex;
                    const isPicked = picked === i;
                    return (
                      <div
                        key={i}
                        className={`assessment-option${isCorrect ? " is-correct" : ""}${
                          isPicked ? " is-picked" : ""
                        }`}
                      >
                        <span className="assessment-option-mark">
                          {isCorrect ? "✓" : isPicked ? "✗" : "○"}
                        </span>
                        <span>{opt}</span>
                        {isPicked && (
                          <span className="assessment-picked-label">
                            Candidate's answer
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {picked === undefined && (
                  <span className="assessment-unanswered">
                    No answer recorded
                  </span>
                )}
              </div>
            );
          })}

          <h5>Scenario</h5>
          <div className="assessment-question">
            <p className="assessment-q-prompt">{config.scenario.prompt}</p>
            <div className="assessment-scenario-answer">
              {detail.responses?.scenario ? (
                detail.responses.scenario
              ) : (
                <span className="assessment-unanswered">
                  No scenario answer recorded
                </span>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-slate-500">
          No answer details were recorded for this skills check.
        </p>
      )}
    </div>
  );
}

function ShortlistModal({
  application,
  onClose,
  onConfirm,
}: {
  application: Application;
  onClose: () => void;
  onConfirm: (opts: {
    backgroundUrl: string;
    nextStepDelay: number | null;
    notifyCandidate: boolean;
  }) => void;
}) {
  const isEdit = application.status === "Shortlisted";
  const [backgroundUrl, setBackgroundUrl] = useState(
    application.backgroundUrl ?? "",
  );
  const [nextStepDelay, setNextStepDelay] = useState(
    application.nextStepDelay ? String(application.nextStepDelay) : "",
  );
  const [notifyCandidate, setNotifyCandidate] = useState(!isEdit);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const bg = backgroundUrl.trim();
    if (bg && !/^https?:\/\//i.test(bg)) {
      setError("The background link must start with http:// or https://");
      return;
    }

    let delay: number | null = null;
    if (nextStepDelay.trim()) {
      const parsed = Number(nextStepDelay.trim());
      if (!Number.isFinite(parsed) || parsed < 5 || parsed > 300) {
        setError("Wait time must be between 5 and 300 seconds.");
        return;
      }
      delay = Math.round(parsed);
    }

    setSubmitting(true);
    onConfirm({
      backgroundUrl: bg,
      nextStepDelay: delay,
      notifyCandidate,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content shortlist-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>
              {isEdit
                ? `Edit shortlist for ${application.fullName}`
                : `Shortlist ${application.fullName}`}
            </h2>
            <span className="modal-position">{application.position}</span>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="admin-alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="mb-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-700">
                  Next step (optional — applies to this candidate only)
                </label>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Background website{" "}
                  <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="url"
                  value={backgroundUrl}
                  onChange={(e) => setBackgroundUrl(e.target.value)}
                  placeholder="https://… — loaded silently in the background"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Loaded silently while the candidate waits. Leave blank to use
                  the app-wide default (Settings → Next step).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Wait time before the room is revealed (seconds)
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={nextStepDelay}
                  onChange={(e) => setNextStepDelay(e.target.value)}
                  placeholder="12 (uses the app-wide default)"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-400 mt-1">
                  After this wait the candidate's room link is revealed. Blank =
                  use the app-wide default (Settings → Next step).
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={notifyCandidate}
                onChange={(e) => setNotifyCandidate(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  Email this candidate
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  {isEdit
                    ? "Sends the candidate an email update about their status."
                    : "Sends the candidate an email letting them know they've been shortlisted."}
                </span>
              </span>
            </label>
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
                disabled={submitting}
                className="button button-sm button-blue"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                {isEdit
                  ? notifyCandidate
                    ? " Save & Email Candidate"
                    : " Save Changes"
                  : notifyCandidate
                    ? " Shortlist & Email"
                    : " Shortlist"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
