import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  Briefcase,
  ClipboardList,
  Link2,
  Loader2,
  Mail,
  Send,
} from "lucide-react";
import { adminFetch } from "@/lib/adminApi";

const STATUS_ORDER = ["New", "Reviewing", "Shortlisted", "Rejected", "Hired"];

const STATUS_COLORS: Record<string, string> = {
  New: "#6366f1",
  Reviewing: "#f59e0b",
  Shortlisted: "#10b981",
  Rejected: "#ef4444",
  Hired: "#22c55e",
};

interface StatsResponse {
  stats?: {
    total?: number;
    byStatus?: Record<string, number>;
    byPosition?: Record<string, number>;
    recentApplications?: Array<{
      id: string;
      fullName: string;
      position: string;
      status: string;
      createdAt: string;
    }>;
  };
}

interface SendStatus {
  dailyLimit: number;
  sentToday: number;
  remaining: number;
}

const QUICK_LINKS = [
  {
    href: "/admin/applications",
    label: "Review applications",
    icon: ClipboardList,
  },
  { href: "/admin/referrals", label: "Manage referrals", icon: Link2 },
  { href: "/admin/contacts", label: "Contacts", icon: Mail },
  { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
];

export function Overview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<NonNullable<StatsResponse["stats"]>>({});
  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [statsRes, sendRes] = await Promise.all([
          adminFetch("/api/admin/stats"),
          adminFetch("/api/admin/referrals/status"),
        ]);
        const [statsData, sendData] = await Promise.all([
          statsRes.json(),
          sendRes.json(),
        ]);
        if (!active) return;
        setStats(statsData.stats ?? {});
        setSendStatus(sendData.status ?? null);
      } catch (err) {
        if (active)
          setError(
            err instanceof Error ? err.message : "Failed to load overview",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="admin-loading">
        <Loader2 size={32} className="animate-spin" />
        <p>Loading overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-alert">
        <AlertCircle size={18} />
        <span>{error}</span>
      </div>
    );
  }

  const total = stats.total ?? 0;
  const byStatus = stats.byStatus ?? {};
  const byPosition = stats.byPosition ?? {};
  const recent = stats.recentApplications ?? [];

  const sentPercent = sendStatus
    ? Math.min(
        100,
        Math.round(
          ((sendStatus.sentToday ?? 0) / Math.max(1, sendStatus.dailyLimit)) *
            100,
        ),
      )
    : 0;

  return (
    <>
      <div className="admin-header-bar">
        <h1 className="admin-title">Overview</h1>
        <span className="admin-count">Hiring at a glance</span>
      </div>

      <div className="overview-grid">
        <div className="overview-card">
          <div className="overview-card-label">Applications</div>
          <div className="overview-card-value">{total}</div>
          <div className="overview-card-sub">total received</div>
        </div>
        <div className="overview-card">
          <div className="overview-card-label">Daily email limit</div>
          <div className="overview-card-value">
            {sendStatus
              ? `${sendStatus.remaining} / ${sendStatus.dailyLimit}`
              : "—"}
          </div>
          <div className="overview-card-sub">referral emails left today</div>
          <div className="overview-progress-track">
            <div
              className="overview-progress-bar"
              style={{ width: `${sentPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="overview-section">
        <h3>Applications by status</h3>
        {STATUS_ORDER.some((s) => (byStatus[s] ?? 0) > 0) ? (
          <div className="overview-status-row">
            {STATUS_ORDER.map((status) => {
              const count = byStatus[status] ?? 0;
              if (count === 0) return null;
              return (
                <span key={status} className="overview-status-chip">
                  <span
                    className="overview-status-dot"
                    style={{ backgroundColor: STATUS_COLORS[status] }}
                  />
                  {status}: <strong>{count}</strong>
                </span>
              );
            })}
          </div>
        ) : (
          <p className="overview-empty-line">No applications yet.</p>
        )}
      </div>

      <div className="overview-section">
        <h3>Top positions</h3>
        {Object.keys(byPosition).length > 0 ? (
          <div className="overview-position-row">
            {Object.entries(byPosition)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([position, count]) => (
                <span key={position} className="overview-position-chip">
                  {position}
                  <strong>{count}</strong>
                </span>
              ))}
          </div>
        ) : (
          <p className="overview-empty-line">No applications yet.</p>
        )}
      </div>

      <div className="overview-section">
        <h3>Recent applications</h3>
        {recent.length > 0 ? (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Position</th>
                  <th>Applied</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.slice(0, 8).map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div className="candidate-info">
                        <div className="candidate-name">{app.fullName}</div>
                      </div>
                    </td>
                    <td>{app.position}</td>
                    <td className="date-cell">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: `${STATUS_COLORS[app.status] || "#94a3b8"}1a`,
                          color: STATUS_COLORS[app.status] || "#94a3b8",
                          borderColor: `${STATUS_COLORS[app.status] || "#94a3b8"}40`,
                        }}
                      >
                        {app.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="overview-empty-line">No recent applications.</p>
        )}
      </div>

      <div className="overview-section">
        <h3>Quick actions</h3>
        <div className="overview-quick-row">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="overview-quick-link"
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
          <Link href="/admin/mail" className="overview-quick-link">
            <Send size={16} />
            Send mail
          </Link>
        </div>
      </div>
    </>
  );
}
