import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  Loader2,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  FileUp,
  UsersRound,
  UserPlus,
} from "lucide-react";
import { ImportModal } from "@/pages/Admin/ImportModal";
import { handleAdminUnauthorized, isUnauthorized } from "@/lib/adminAuth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface ContactRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  createdAt: string;
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

function formatStamp(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ContactsResponse {
  contacts: ContactRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function ContactsAdmin({ token }: { token: string }) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [footprint, setFootprint] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importingOpen, setImportingOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState<
    "add" | "addAll" | "delete" | null
  >(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
      });
      if (search) params.set("search", search);
      if (footprint) params.set("footprint", footprint);
      const res = await fetch(`${API_BASE}/api/admin/contacts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (isUnauthorized(res)) {
        handleAdminUnauthorized();
        return;
      }
      const data = (await res
        .json()
        .catch(() => null)) as ContactsResponse | null;
      if (!res.ok)
        throw new Error(
          (data as { error?: string } | null)?.error ||
            "Failed to fetch contacts",
        );
      if (data) {
        setContacts(data.contacts);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
        setSelected(new Set());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [token, page, search, footprint]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (contact: ContactRow) => {
    if (
      !window.confirm(`Delete contact "${contact.fullName || contact.email}"?`)
    ) {
      return;
    }
    setDeleting(contact.id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts/${contact.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (isUnauthorized(res)) {
        handleAdminUnauthorized();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to delete contact");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contact");
    } finally {
      setDeleting(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === contacts.length) return new Set();
      return new Set(contacts.map((c) => c.id));
    });
  };

  const addToReferrals = async (ids: string[], all: boolean) => {
    const what = all
      ? `ALL ${total} contacts`
      : `${ids.length} selected contact${ids.length === 1 ? "" : "s"}`;
    if (
      !window.confirm(
        `Add ${what} as referrals? Anyone already in referrals is skipped.`,
      )
    )
      return;
    const referredBy =
      window.prompt(
        "Referrer name (shown on each private page), optional",
        "",
      ) || undefined;
    if (referredBy !== undefined && referredBy === null) return;
    const jobTitle =
      window.prompt("Job title (shown on each private page), optional", "") ||
      undefined;
    if (jobTitle !== undefined && jobTitle === null) return;
    setBusyAction(all ? "addAll" : "add");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/referrals/from-contacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ids: all ? undefined : ids,
          referredBy,
          jobTitle,
        }),
      });
      if (isUnauthorized(res)) {
        handleAdminUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add referrals");
      const created = data.created?.length ?? 0;
      const skipped = data.skipped?.length ?? 0;
      alert(
        `${created} added as referral${created === 1 ? "" : "s"}. ${skipped} skipped (already referred or missing a name).`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add referrals");
    } finally {
      setBusyAction(null);
    }
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    if (
      !window.confirm(
        `Delete ${ids.length} selected contact${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    )
      return;
    setBusyAction("delete");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts/delete-many`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids }),
      });
      if (isUnauthorized(res)) {
        handleAdminUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete contacts");
      alert(`${data.deleted ?? ids.length} contacts deleted.`);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete contacts",
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
      <div className="admin-header-bar">
        <h1 className="admin-title">Contacts</h1>
        <span className="admin-count">{total} total</span>
      </div>

      {error && (
        <div className="admin-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-status-strip admin-stats-chips">
        {[
          { key: "", label: "All", count: total },
          {
            key: "visited",
            label: "Visited",
            count: contacts.filter((c) => c.footprint && c.footprint.visits > 0)
              .length,
          },
          {
            key: "hesitant",
            label: "Hesitant",
            count: contacts.filter((c) => c.footprint?.hesitant).length,
          },
          {
            key: "blocked",
            label: "Mobile blocked",
            count: contacts.filter(
              (c) => c.footprint && c.footprint.blocked > 0,
            ).length,
          },
        ].map((chip) => (
          <button
            key={chip.key}
            className={`stats-chip${footprint === chip.key ? " active" : ""}`}
            onClick={() => {
              setFootprint(chip.key === footprint ? "" : chip.key);
              setPage(1);
            }}
            title={`Show contacts: ${chip.label}`}
          >
            <strong>{chip.count}</strong> {chip.label}
          </button>
        ))}
      </div>

      <div className="admin-filters">
        <div className="filter-group">
          <div className="search-wrapper">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search by name, email, phone, address, postal code..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="filter-input"
            />
          </div>
        </div>
        <div className="filter-group">
          <button
            className="button button-blue button-sm"
            onClick={() => setImportingOpen(true)}
          >
            <FileUp size={15} /> Import contacts
          </button>
          <button
            className="button button-outline button-sm"
            onClick={() => addToReferrals([], true)}
            disabled={busyAction !== null}
          >
            {busyAction === "addAll" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <UsersRound size={15} />
            )}{" "}
            Add all to referrals
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="admin-selection-bar">
          <span>
            <strong>{selected.size}</strong> selected
          </span>
          <div className="selection-bar-actions">
            <button
              onClick={() => addToReferrals([...selected], false)}
              disabled={busyAction !== null}
              className="button button-blue button-sm"
            >
              {busyAction === "add" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <UserPlus size={15} />
              )}{" "}
              Add to referrals
            </button>
            <button
              onClick={deleteSelected}
              disabled={busyAction !== null}
              className="button button-outline button-sm"
            >
              {busyAction === "delete" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Trash2 size={15} />
              )}{" "}
              Delete selected
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="admin-loading">
          <Loader2 size={32} className="animate-spin" />
          <p>Loading contacts...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="admin-empty">
          <p>No contacts found.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={
                        contacts.length > 0 && selected.size === contacts.length
                      }
                      onChange={toggleAll}
                    />
                  </th>
                  <th>Name</th>
                  <th>Email / Phone</th>
                  <th>Address</th>
                  <th>Postal Code</th>
                  <th>Footprint</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(contact.id)}
                        onChange={() => toggleSelected(contact.id)}
                      />
                    </td>
                    <td>
                      <div className="candidate-info">
                        <div className="candidate-name">
                          {contact.fullName || "—"}
                        </div>
                        <div className="candidate-contact">
                          {(contact.firstName || contact.lastName) &&
                            [contact.firstName, contact.lastName]
                              .filter(Boolean)
                              .join(" ")}
                        </div>
                      </div>
                    </td>
                    <td>
                      {contact.email || contact.phone ? (
                        <div className="candidate-contact">
                          {contact.email && (
                            <a href={`mailto:${contact.email}`}>
                              <Mail size={12} /> {contact.email}
                            </a>
                          )}
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`}>
                              <Phone size={12} /> {contact.phone}
                            </a>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div className="location-info">
                        <MapPin size={12} /> {contact.address || "—"}
                      </div>
                    </td>
                    <td>{contact.postalCode || "—"}</td>
                    <td>
                      {contact.footprint ? (
                        <div className="footprint-cell">
                          {contact.footprint.visits > 0 ? (
                            <span className="footprint-line">
                              <span
                                className={`footprint-badge ${
                                  contact.footprint.hesitant
                                    ? "footprint-badge-hesitant"
                                    : "footprint-badge-visited"
                                }`}
                              >
                                {contact.footprint.hesitant ? "⚠" : "✓"}{" "}
                                {contact.footprint.visits} visit
                                {contact.footprint.visits === 1 ? "" : "s"}
                                {contact.footprint.lastVisitDevice &&
                                  ` · ${contact.footprint.lastVisitDevice}`}
                              </span>
                              {contact.footprint.hesitant && (
                                <span className="footprint-hesitant-label">
                                  Hesitant — no click yet
                                </span>
                              )}
                              {contact.footprint.blocked > 0 && (
                                <span className="footprint-badge footprint-badge-blocked">
                                  🔒 {contact.footprint.blocked} mobile attempt
                                  {contact.footprint.blocked === 1
                                    ? ""
                                    : "s"}{" "}
                                  blocked
                                </span>
                              )}
                              <span className="footprint-time">
                                {formatStamp(contact.footprint.lastVisitAt)}
                              </span>
                            </span>
                          ) : (
                            <span className="footprint-badge footprint-badge-none">
                              Not visited
                            </span>
                          )}
                          {contact.footprint.clicks > 0 && (
                            <span className="footprint-line">
                              <span className="footprint-badge footprint-badge-clicked">
                                C clicked
                                {contact.footprint.lastClickDevice &&
                                  ` · ${contact.footprint.lastClickDevice}`}
                              </span>
                              <span className="footprint-time">
                                {formatStamp(contact.footprint.lastClickAt)}
                              </span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="footprint-badge footprint-badge-none">
                          No activity
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(contact)}
                        disabled={deleting === contact.id}
                        className="action-btn action-btn-danger"
                        title="Delete contact"
                      >
                        {deleting === contact.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
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

      {importingOpen && (
        <ImportModal
          token={token}
          existingCount={total}
          onClose={() => setImportingOpen(false)}
          onDone={(created, updated, skipped) => {
            const parts: string[] = [];
            if (created)
              parts.push(
                `Imported ${created} new contact${created === 1 ? "" : "s"}`,
              );
            if (updated) parts.push(`${updated} existing contacts updated`);
            parts.push(`${skipped.length} skipped (missing name or errors)`);
            alert(parts.join(".\n") + ".");
            setImportingOpen(false);
            load();
          }}
        />
      )}
    </>
  );
}
