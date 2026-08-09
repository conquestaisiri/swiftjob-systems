import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw, Activity } from "lucide-react";
import { handleAdminUnauthorized, isUnauthorized } from "@/lib/adminAuth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface ActivityRow {
  id: string;
  actor: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetEmail: string | null;
  detail: Record<string, unknown> | null;
  status: string;
  error: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  "mail.referral_sent": "Referral invite emailed",
  "mail.custom_sent": "Custom email sent",
  "admin.referral_created": "Referral created",
  "admin.referral_updated": "Referral updated",
  "admin.referral_deleted": "Referral deleted",
  "admin.referrals_cleared": "All referrals cleared",
  "admin.referrals_imported": "Referrals imported",
  "admin.referrals_sent": "Batch emails sent",
  "admin.referrals_from_contacts": "Referrals created from contacts",
  "admin.contacts_imported": "Contacts imported",
  "admin.contacts_deleted": "Contacts deleted",
  "admin.contact_deleted": "Contact deleted",
  "admin.content_saved": "Page & email content saved",
  "admin.content_applied_all": "Content applied to all",
  "admin.content_applied_selected": "Content applied to selected",
  "admin.content_reset": "Content reverted to defaults",
  "admin.daily_limit_updated": "Daily send limit changed",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

export function ActivityAdmin({ token }: { token: string }) {
  const [events, setEvents] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (actionFilter) params.set("action", actionFilter);
      const res = await fetch(`${API_BASE}/api/admin/activities?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (isUnauthorized(res)) {
        handleAdminUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load activity");
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [token, actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="admin-header-bar">
        <h1 className="admin-title">Activity log</h1>
        <div className="admin-header-actions-inline">
          <span className="admin-count">{total} events</span>
          <button
            className="button button-outline button-sm"
            onClick={load}
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}{" "}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-filters">
        <div className="filter-group">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="filter-select"
            aria-label="Filter by action"
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">
          <Loader2 size={32} className="animate-spin" />
          <p>Loading activity…</p>
        </div>
      ) : events.length === 0 ? (
        <div className="admin-empty">
          <Activity size={44} />
          <p>No activity recorded yet.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Recipient / Target</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <div className="activity-time">
                      {new Date(ev.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td>
                    <div className="activity-action">
                      {actionLabel(ev.action)}
                    </div>
                    <div className="activity-code">{ev.action}</div>
                  </td>
                  <td>
                    {ev.targetEmail ? (
                      <a href={`mailto:${ev.targetEmail}`}>{ev.targetEmail}</a>
                    ) : (
                      (ev.targetType ?? "—")
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        ev.status === "failed"
                          ? "status-pending"
                          : "status-live"
                      }`}
                    >
                      {ev.status}
                    </span>
                    {ev.error && (
                      <div className="activity-error" title={ev.error}>
                        {ev.error}
                      </div>
                    )}
                  </td>
                  <td>
                    {ev.detail ? (
                      <div className="activity-code">
                        {JSON.stringify(ev.detail)}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
