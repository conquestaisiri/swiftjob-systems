import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
export function CandidateReferralLanding() {
  const [location] = useLocation(); const [error, setError] = useState("");
  useEffect(() => { const code = location.split("/").pop()?.toUpperCase() ?? ""; fetch(`${API_BASE}/api/candidate-referrals/${encodeURIComponent(code)}`).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error || "This referral link is no longer available."); const target = data.jobSlug ? `/careers/${encodeURIComponent(data.jobSlug)}?ref=${encodeURIComponent(data.code)}` : `/careers?ref=${encodeURIComponent(data.code)}`; window.location.replace(target); }).catch((err) => setError(err instanceof Error ? err.message : "This referral link is no longer available.")); }, [location]);
  return <SiteLayout title="Referral link — SwiftJob"><div className="not-found-shell"><div className="container" style={{ textAlign: "center", padding: "120px 0" }}>{error ? <><h1>Referral link unavailable</h1><p>{error}</p></> : <><Loader2 size={38} className="spin" style={{ margin: "0 auto 20px" }} /><p>Opening the referred position…</p></>}</div></div></SiteLayout>;
}
