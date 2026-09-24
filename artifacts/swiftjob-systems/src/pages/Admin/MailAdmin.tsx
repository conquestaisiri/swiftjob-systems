import { useState, useEffect } from "react";
import {
  Send,
  Loader2,
  AlertCircle,
  UsersRound,
  Link2,
  Search,
  CheckCircle2,
  Mail,
  X,
} from "lucide-react";
import { handleAdminUnauthorized, isUnauthorized } from "@/lib/adminAuth";
import type { Job } from "@/data/jobs";
import { parseMailRecipients } from "@/lib/mailRecipients";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface PickItem {
  id: string;
  name: string;
  email: string | null;
}

interface SendResult {
  email: string;
  created?: boolean;
  sent: boolean;
  code?: string | null;
  error?: string;
}

interface SendResponse {
  sent: number;
  created: number;
  failed: Array<{ email: string; error: string }>;
  results: SendResult[];
}

export function MailAdmin({ token }: { token: string }) {
  const [recipientsText, setRecipientsText] = useState("");
  const [mode, setMode] = useState<"referral" | "custom">("referral");
  const [referredBy, setReferredBy] = useState("");
  const [jobSlug, setJobSlug] = useState("");
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SendResponse | null>(null);
  const [picking, setPicking] = useState<"contacts" | "referrals" | null>(null);

  const recipientParse = parseMailRecipients(recipientsText);
  const recipients = recipientParse.recipients;

  useEffect(() => {
    if (mode !== "referral") return;
    let cancelled = false;
    setJobsLoading(true);
    fetch(`${API_BASE}/api/admin/jobs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (isUnauthorized(res)) {
          handleAdminUnauthorized();
          return null;
        }
        if (!res.ok) throw new Error("Failed to load open roles.");
        return (await res.json()) as {
          jobs?: Array<Job & { isActive?: boolean }>;
        };
      })
      .then((data) => {
        if (!cancelled && data) {
          setAvailableJobs(
            (data.jobs ?? []).filter((job) => job.isActive !== false),
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAvailableJobs([]);
          setError(
            err instanceof Error ? err.message : "Failed to load open roles.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setJobsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleSend = async () => {
    setError("");
    setResult(null);
    if (recipients.length === 0) {
      setError("Enter at least one email address.");
      return;
    }
    if (recipientParse.invalidLines.length > 0) {
      setError(
        `Fix ${recipientParse.invalidLines.length} invalid recipient line${recipientParse.invalidLines.length === 1 ? "" : "s"} before sending.`,
      );
      return;
    }
    if (recipients.length > 100) {
      setError("Maximum 100 recipients per send.");
      return;
    }
    if (mode === "referral" && !jobSlug) {
      setError("Choose an open role before sending a referral invite.");
      return;
    }
    // Custom mode needs a real subject and body — without this the server
    // accepts the request but fails every recipient silently.
    if (mode === "custom") {
      const problems: string[] = [];
      if (!subject.trim()) problems.push("a subject");
      if (!body.trim()) problems.push("a message body");
      if (problems.length) {
        setError(
          `Custom messages need ${problems.join(" and ")} before sending.`,
        );
        return;
      }
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/mail/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipients,
          mode,
          referredBy: referredBy.trim() || undefined,
          jobSlug: mode === "referral" ? jobSlug : undefined,
          subject: subject.trim() || undefined,
          body,
        }),
      });
      if (isUnauthorized(res)) {
        handleAdminUnauthorized();
        return;
      }
      const data = (await res.json().catch(() => null)) as SendResponse | null;
      if (!res.ok)
        throw new Error(
          (data as { error?: string } | null)?.error || "Failed to send mail",
        );
      setResult(data as SendResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send mail");
    } finally {
      setSending(false);
    }
  };

  const duplicateOnly =
    result &&
    result.sent === 0 &&
    result.failed.length > 0 &&
    result.failed.every((item) => item.error === "Already sent");

  return (
    <>
      <div className="admin-header-bar">
        <h1 className="admin-title">Send mail</h1>
        <span className="admin-count">
          {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <div className="admin-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="mail-layout">
        <div className="mail-compose">
          <div className="admin-panel">
            <h3 className="admin-panel-title">Recipients</h3>
            <p className="admin-panel-hint">
              One recipient per line — email, &quot;Name &lt;email&gt;&quot;, or
              &quot;Name email&quot;. You can also pick people from your database.
            </p>
            <textarea
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              placeholder={"name@example.com\nJane Smith <jane@example.com>"}
              rows={6}
              aria-label="Email recipients, one per line"
              className="filter-input admin-input mail-recipient-input"
            />
            {recipientParse.invalidLines.length > 0 && (
              <div className="mail-recipient-validation invalid" role="alert">
                <strong>
                  {recipientParse.invalidLines.length} invalid line
                  {recipientParse.invalidLines.length === 1 ? "" : "s"} — sending is disabled until corrected.
                </strong>
                <ul>
                  {recipientParse.invalidLines.slice(0, 4).map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
                  {recipientParse.invalidLines.length > 4 && (
                    <li>And {recipientParse.invalidLines.length - 4} more.</li>
                  )}
                </ul>
              </div>
            )}
            {recipientParse.duplicateEmails.length > 0 && (
              <p className="mail-recipient-validation duplicate" role="status">
                {recipientParse.duplicateEmails.length} duplicate address
                {recipientParse.duplicateEmails.length === 1 ? "" : "es"} will be sent only once.
              </p>
            )}
            {recipients.length > 100 && (
              <p className="mail-recipient-validation invalid" role="alert">
                The limit is 100 unique recipients per send. Remove at least {recipients.length - 100}.
              </p>
            )}
            <div className="mail-pick-actions">
              <button
                className="button button-outline button-sm"
                onClick={() => setPicking("contacts")}
              >
                <UsersRound size={15} /> Add from contacts
              </button>
              <button
                className="button button-outline button-sm"
                onClick={() => setPicking("referrals")}
              >
                <Link2 size={15} /> Add from referrals
              </button>
            </div>
            {recipients.length > 0 && (
              <div className="recipient-chips">
                {recipients.slice(0, 8).map((r) => (
                  <span key={r.email} className="recipient-chip">
                    {r.fullName ? `${r.fullName} <${r.email}>` : r.email}
                  </span>
                ))}
                {recipients.length > 8 && (
                  <span className="recipient-chip recipient-chip-more">
                    +{recipients.length - 8} more in the list above
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="admin-panel">
            <h3 className="admin-panel-title">Message</h3>
            <div className="mail-mode-toggle">
              <button
                className={`mail-mode-btn${mode === "referral" ? " active" : ""}`}
                onClick={() => setMode("referral")}
              >
                Referral invite
              </button>
              <button
                className={`mail-mode-btn${mode === "custom" ? " active" : ""}`}
                onClick={() => setMode("custom")}
              >
                Custom message
              </button>
            </div>

            {mode === "referral" ? (
              <>
                <p className="admin-panel-hint">
                  Each recipient gets their own private referral link and the
                  branded briefing email. Anyone without a referral yet is
                  created automatically.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="mb-1">
                    <label className="admin-field-label">
                      Referrer name <span className="opt">(optional)</span>
                    </label>
                    <input
                      value={referredBy}
                      onChange={(e) => setReferredBy(e.target.value)}
                      placeholder="e.g. Tracy Miller"
                      className="filter-input admin-input"
                    />
                  </div>
                  <div className="mb-1">
                    <label className="admin-field-label">
                      Job for this invitation <span className="req">*</span>
                    </label>
                    <select
                      required
                      value={jobSlug}
                      onChange={(e) => setJobSlug(e.target.value)}
                      disabled={jobsLoading}
                      className="filter-input admin-input"
                    >
                      <option value="">
                        {jobsLoading ? "Loading open roles…" : "Select an open role"}
                      </option>
                      {availableJobs.map((job) => (
                        <option key={job.slug} value={job.slug}>
                          {job.title}
                        </option>
                      ))}
                    </select>
                    <p className="admin-panel-hint">
                      The selected open role is saved with the referral and used
                      in the invitation email.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3">
                  <label className="admin-field-label">
                    Subject <span className="req">*</span>
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Your message subject"
                    className="filter-input admin-input"
                  />
                </div>
                <div className="mb-3">
                  <label className="admin-field-label">
                    Message <span className="req">*</span>
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={7}
                    placeholder="Write your message here. One paragraph per blank line."
                    className="filter-input admin-input"
                  />
                </div>
              </>
            )}

            <div className="mail-send-row">
              <button
                onClick={handleSend}
                disabled={
                  sending ||
                  recipients.length === 0 ||
                  recipientParse.invalidLines.length > 0 ||
                  recipients.length > 100
                }
                className="button button-blue"
              >
                {sending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}{" "}
                {sending
                  ? " Sending…"
                  : `Send to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>

        {result && (
          <div className="admin-panel mail-result">
            <h3 className="admin-panel-title">
              {result.failed.length === 0 ? (
                <>
                  <CheckCircle2 size={16} /> Delivery result
                </>
              ) : (
                <>
                  <AlertCircle size={16} /> Delivery result —{" "}
                  {result.sent === 0
                    ? duplicateOnly
                      ? "no new messages sent"
                      : "nothing was sent"
                    : "partially delivered"}
                </>
              )}
            </h3>
            <p>
              <strong>{result.sent}</strong> delivered ·{" "}
              <strong>{result.created}</strong> referral
              {result.created === 1 ? "" : "s"} created ·{" "}
              <strong>{result.failed.length}</strong> failed
            </p>
            {result.results.length > 0 && (
              <ul className="mail-result-list">
                {result.results.map((r) => (
                  <li key={r.email}>
                    <span
                      className={`mail-result-dot ${r.sent ? "ok" : "fail"}`}
                    />
                    <span>
                      {r.email}
                      {r.created && (
                        <span className="mail-result-tag">new referral</span>
                      )}
                      {r.code && (
                        <span className="mail-result-tag">{r.code}</span>
                      )}
                    </span>
                    {r.error && (
                      <span className="mail-result-error">
                        {r.error === "Already sent"
                          ? "Already sent — duplicate invitation prevented"
                          : r.error}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {picking && (
        <PickerModal
          token={token}
          source={picking}
          onClose={() => setPicking(null)}
          onAdd={(items) => {
            const seen = new Set(
              parseMailRecipients(recipientsText).recipients.map((r) => r.email),
            );
            const additions = items
              .filter((i) => i.email && !seen.has(i.email.toLowerCase()))
              .map((i) => `${i.name} <${i.email}>`);
            setRecipientsText((prev) => {
              const next = prev.trim();
              return next
                ? `${next}\n${additions.join("\n")}`
                : additions.join("\n");
            });
            setPicking(null);
          }}
        />
      )}
    </>
  );
}

function PickerModal({
  token,
  source,
  onClose,
  onAdd,
}: {
  token: string;
  source: "contacts" | "referrals";
  onClose: () => void;
  onAdd: (items: PickItem[]) => void;
}) {
  const [items, setItems] = useState<PickItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/admin/${source}?page=1&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (isUnauthorized(res)) {
          handleAdminUnauthorized();
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        const rows = source === "contacts" ? data.contacts : data.referrals;
        const mapped: PickItem[] = (Array.isArray(rows) ? rows : [])
          .filter((r) => r.email)
          .map((r) => ({
            id: r.id,
            name: r.fullName || r.email,
            email: r.email,
          }));
        setItems(mapped);
        setPage(1);
        setHasMore(
          mapped.length < Number(data.pagination?.total ?? mapped.length),
        );
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load list");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, source]);

  const loadMore = async () => {
    setLoadingMore(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/${source}?page=${page + 1}&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (isUnauthorized(res)) {
        handleAdminUnauthorized();
        return;
      }
      const data = await res.json();
      const rows = source === "contacts" ? data.contacts : data.referrals;
      const mapped: PickItem[] = (Array.isArray(rows) ? rows : [])
        .filter((r) => r.email)
        .map((r) => ({
          id: r.id,
          name: r.fullName || r.email,
          email: r.email,
        }));
      const next = [
        ...items,
        ...mapped.filter((m) => !items.some((i) => i.id === m.id)),
      ];
      setItems(next);
      setPage((p) => p + 1);
      setHasMore(next.length < Number(data.pagination?.total ?? next.length));
    } catch {
      setError("Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = items.filter((i) => {
    const q = searchInput.toLowerCase();
    if (!q) return true;
    return (
      i.name.toLowerCase().includes(q) ||
      (i.email ?? "").toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content shortlist-modal picker-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>
              {source === "contacts"
                ? "Add from contacts"
                : "Add from referrals"}
            </h2>
            <span className="modal-position">
              {items.length} with email · {selected.size} selected
            </span>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="search-wrapper" style={{ marginBottom: 12 }}>
            <Search size={18} />
            <input
              type="search"
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="filter-input"
            />
          </div>
          {error && (
            <div className="admin-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {loading ? (
            <div className="admin-loading" style={{ padding: 30 }}>
              <Loader2 size={26} className="animate-spin" />
              <p>Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="admin-empty">
              <Mail size={36} />
              <p>No {source} with an email address found.</p>
            </div>
          ) : (
            <div className="picker-list">
              {filtered.map((i) => (
                <label key={i.id} className="picker-row">
                  <input
                    type="checkbox"
                    checked={selected.has(i.id)}
                    onChange={() => toggle(i.id)}
                  />
                  <div className="picker-info">
                    <div className="picker-name">{i.name}</div>
                    <div className="picker-email">{i.email}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
          {hasMore && !loading && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="button button-sm button-outline picker-load-more"
            >
              {loadingMore ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <UsersRound size={15} />
              )}
              {loadingMore ? " Loading…" : " Load more"}
            </button>
          )}
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
              type="button"
              disabled={selected.size === 0}
              onClick={() => onAdd(filtered.filter((i) => selected.has(i.id)))}
              className="button button-blue"
            >
              <UsersRound size={15} /> Add {selected.size} to recipients
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
