import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Loader2, WalletCards } from "lucide-react";
import { adminFetch } from "@/lib/adminApi";

type CandidateReferral = {
  id: string;
  ownerEmail: string;
  referredEmail: string | null;
  jobSlug: string | null;
  jobTitle: string;
  status: "applied" | "hired" | "rejected" | string;
  rewardCents: number;
  payoutStatus: "pending" | "paid" | string;
  createdAt: string;
  updatedAt: string;
};

const money = (cents: number) => `$${Math.round(cents / 100)}`;
const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function CandidateReferralRewardsAdmin({ token }: { token: string }) {
  const [rows, setRows] = useState<CandidateReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await adminFetch("/api/admin/candidate-referrals");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load referral rewards");
      setRows(data.referrals ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load referral rewards");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [token]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.total += 1;
    if (row.status === "hired") acc.hired += 1;
    if (row.payoutStatus === "paid") acc.paid += row.rewardCents;
    else if (row.status === "hired") acc.pending += row.rewardCents;
    return acc;
  }, { total: 0, hired: 0, pending: 0, paid: 0 }), [rows]);

  const update = async (id: string, change: { status?: string; payoutStatus?: string }) => {
    setSaving(id); setError(""); setSaved(null);
    try {
      const response = await adminFetch(`/api/admin/candidate-referrals/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update referral");
      setRows((current) => current.map((row) => row.id === id ? { ...row, ...data.referral } : row));
      setSaved(id); window.setTimeout(() => setSaved((current) => current === id ? null : current), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update referral");
    } finally { setSaving(null); }
  };

  if (loading) return <div className="admin-loading"><Loader2 size={32} className="animate-spin" /><p>Loading referral rewards...</p></div>;

  return <>
    <div className="admin-header-bar"><div><h1 className="admin-title">Referral rewards</h1><p className="admin-subtitle">Verify referred hires and mark approved rewards as paid.</p></div><button className="button button-outline" onClick={() => void load()}>Refresh</button></div>
    {error && <div className="admin-alert"><AlertCircle size={18} /><span>{error}</span></div>}
    <div className="admin-stats-grid">
      <div className="admin-stat-card"><WalletCards size={18} /><span>Tracked referrals</span><strong>{totals.total}</strong></div>
      <div className="admin-stat-card"><WalletCards size={18} /><span>Verified hires</span><strong>{totals.hired}</strong></div>
      <div className="admin-stat-card"><WalletCards size={18} /><span>Pending rewards</span><strong>{money(totals.pending)}</strong></div>
      <div className="admin-stat-card"><WalletCards size={18} /><span>Paid rewards</span><strong>{money(totals.paid)}</strong></div>
    </div>
    {rows.length === 0 ? <div className="admin-empty"><WalletCards size={48} /><h3>No account referrals yet</h3><p>When a candidate applies through an account link, the referral will appear here.</p></div> : <div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Candidate</th><th>Referrer</th><th>Role</th><th>Reward</th><th>Applied</th><th>Status</th><th>Payout</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.referredEmail || "Unknown candidate"}</td><td>{row.ownerEmail}</td><td>{row.jobTitle}</td><td><strong>{money(row.rewardCents)}</strong></td><td className="date-cell">{date(row.createdAt)}</td><td><select aria-label={`Status for ${row.referredEmail || row.id}`} value={row.status} disabled={saving === row.id} onChange={(e) => void update(row.id, { status: e.target.value })}><option value="applied">Applied</option><option value="hired">Hired</option><option value="rejected">Rejected</option></select></td><td><select aria-label={`Payout for ${row.referredEmail || row.id}`} value={row.payoutStatus} disabled={saving === row.id || row.status !== "hired"} onChange={(e) => void update(row.id, { payoutStatus: e.target.value })}><option value="pending">Pending</option><option value="paid">Paid</option></select>{saved === row.id && <span className="admin-inline-saved"><Check size={13} /> Saved</span>}</td></tr>)}</tbody></table></div>}
  </>;
}
