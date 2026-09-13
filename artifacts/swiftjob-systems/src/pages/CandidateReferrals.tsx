import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Copy, Link2, Loader2, Plus, UserRound, WalletCards } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type LinkRow = { code: string; jobSlug: string | null; jobTitle: string; rewardCents: number; url: string };
type ReferralRow = { id: string; referredEmail: string | null; jobSlug: string | null; status: string; rewardCents: number; payoutStatus: string; createdAt: string };

function money(cents: number) { return `$${Math.round(cents / 100)}`; }

export function CandidateReferrals() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("candidate_token"));
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [totals, setTotals] = useState({ total: 0, hired: 0, pendingCents: 0, paidCents: 0 });
  const [jobs, setJobs] = useState<Array<{ slug: string; title: string }>>([]);
  const [jobSlug, setJobSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  const load = async (activeToken: string) => {
    const res = await fetch(`${API_BASE}/api/candidate/referrals`, { headers: { Authorization: `Bearer ${activeToken}` } });
    if (res.status === 401) { localStorage.removeItem("candidate_token"); window.location.href = "/login"; return; }
    if (!res.ok) throw new Error("Could not load referrals");
    const data = await res.json();
    setLinks(data.links ?? []); setReferrals(data.referrals ?? []); setTotals(data.totals ?? totals);
  };

  useEffect(() => {
    if (!token) { window.location.href = "/login"; return; }
    Promise.all([
      load(token),
      fetch(`${API_BASE}/api/jobs`).then((res) => res.ok ? res.json() : { jobs: [] }),
    ]).then(([, jobData]) => setJobs((jobData.jobs ?? []).map((job: { slug: string; title: string }) => ({ slug: job.slug, title: job.title })))).catch(() => setError("Could not load your referral dashboard. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  const createLink = async () => {
    if (!token || saving) return;
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/candidate/referrals`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ jobSlug: jobSlug || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create link");
      setLinks((current) => [data.link, ...current]); setJobSlug("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create link"); }
    finally { setSaving(false); }
  };

  const copy = async (row: LinkRow) => {
    try { await navigator.clipboard.writeText(row.url); setCopied(row.code); setTimeout(() => setCopied(""), 1800); }
    catch { setError("Copy failed. Select the link and copy it manually."); }
  };

  const logout = async () => { await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {}); localStorage.removeItem("candidate_token"); setToken(null); window.location.href = "/login"; };

  if (!token) return null;
  return <SiteLayout title="Referrals — SwiftJob">
    <div className="candidate-shell">
      <header className="candidate-header"><div className="container candidate-header-inner">
        <Link href="/" className="candidate-brand"><img src="/swiftjob-mark-light.png?v=supplied-20260912" alt="SwiftJob" className="candidate-logo" /></Link>
        <nav className="candidate-portal-nav" aria-label="Candidate portal"><Link href="/candidate/applications">Applications</Link><Link href="/candidate/profile">Profile</Link><Link href="/candidate/referrals" className="active">Referrals</Link><button className="button button-ghost button-sm" onClick={logout}>Sign out</button></nav>
      </div></header>
      <main className="candidate-main"><div className="container">
        <div className="candidate-header-bar"><div><h1 className="candidate-title">Referrals</h1><p className="candidate-subtitle">Share a role with someone you trust. Each role shows its own reward, from $40 to $100.</p></div><Link href="/candidate/applications" className="button button-outline"><ArrowLeft size={15} /> Applications</Link></div>
        {error && <div className="candidate-alert" role="alert">{error}</div>}
        {loading ? <div className="candidate-loading"><Loader2 size={32} className="animate-spin" /><p>Loading your referral dashboard…</p></div> : <>
          <div className="candidate-stats-grid"><div className="candidate-stat-card"><Link2 size={19} /><strong>{totals.total}</strong><span>Total referrals</span></div><div className="candidate-stat-card"><UserRound size={19} /><strong>{totals.hired}</strong><span>Verified hires</span></div><div className="candidate-stat-card"><WalletCards size={19} /><strong>{money(totals.pendingCents)}</strong><span>Pending rewards</span></div><div className="candidate-stat-card"><WalletCards size={19} /><strong>{money(totals.paidCents)}</strong><span>Paid rewards</span></div></div>
          <section className="candidate-panel"><div className="candidate-panel-heading"><div><h2>Share a referral link</h2><p>Create a link for one role or for any open position.</p></div><div className="candidate-referral-create"><select aria-label="Role for referral link" value={jobSlug} onChange={(e) => setJobSlug(e.target.value)}><option value="">Any open position</option>{jobs.map((job) => <option key={job.slug} value={job.slug}>{job.title}</option>)}</select><button className="button button-blue" onClick={createLink} disabled={saving}><Plus size={16} /> {saving ? "Creating…" : "Create link"}</button></div></div>
            <div className="candidate-link-list">{links.map((row) => <div className="candidate-link-row" key={row.code}><div><strong>{row.jobTitle}</strong><span>Reward: {money(row.rewardCents)}</span><code>{row.url}</code></div><button className="button button-outline button-sm" onClick={() => copy(row)}><Copy size={14} /> {copied === row.code ? "Copied" : "Copy link"}</button></div>)}</div>
          </section>
          <section className="candidate-panel"><div className="candidate-panel-heading"><div><h2>Referral activity</h2><p>Rewards remain pending until SwiftJob verifies the hire.</p></div></div>{referrals.length === 0 ? <p className="candidate-panel-empty">No one has applied through your links yet.</p> : <div className="candidate-referral-table"><div className="candidate-referral-table-head"><span>Candidate</span><span>Role</span><span>Status</span><span>Reward</span></div>{referrals.map((row) => <div className="candidate-referral-table-row" key={row.id}><span>{row.referredEmail || "Candidate"}</span><span>{row.jobSlug || "Open position"}</span><span className="status-badge status-live">{row.status}</span><span>{money(row.rewardCents)} · {row.payoutStatus}</span></div>)}</div>}</section>
        </>}
      </div></main>
    </div>
  </SiteLayout>;
}
