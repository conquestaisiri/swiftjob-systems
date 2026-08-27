import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle,
  Mail,
  ArrowUpRight,
  ArrowLeft,
  ClipboardCheck,
  ArrowRight,
  Loader2,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { trackEvent } from "@/lib/tracking";
import { CAREERS_EMAIL } from "@/lib/contact";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface AssessmentStatus {
  ok: boolean;
  applicationId: string;
  jobSlug: string;
  jobTitle: string;
  needsAssessment: boolean;
  track: string;
  status: string;
  result: { score: number; maxScore: number; completedAt: string } | null;
}

export function ApplicationSuccess() {
  const params = new URLSearchParams(window.location.search);
  const applicationId = params.get("id") ?? "";
  const position = params.get("position") ?? "the position";
  const jobSlug = params.get("job") ?? "";
  const email = params.get("email") ?? "";

  const [assessment, setAssessment] = useState<AssessmentStatus | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(true);

  const referenceCode = params.get("ref") ?? "";
  const [pw, setPw] = useState("");
  const [pwState, setPwState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  const [pwMsg, setPwMsg] = useState("");

  const claimPassword = async () => {
    if (pwState === "busy") return;
    if (pw.length < 8) {
      setPwState("error");
      setPwMsg("Use at least 8 characters.");
      return;
    }
    setPwState("busy");
    setPwMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          applicationId,
          password: pw,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not set password.");
      setPwState("done");
      setPwMsg("Password saved — you can sign in with it anytime.");
    } catch (err) {
      setPwState("error");
      setPwMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    trackEvent("apply_submit", {
      position,
      campaign: params.get("campaign") ?? undefined,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!applicationId || !email) {
      setAssessmentLoading(false);
      return;
    }
    const qs = new URLSearchParams({ email });
    if (jobSlug) qs.set("job", jobSlug);
    fetch(
      `${API_BASE}/api/assessments/${encodeURIComponent(applicationId)}?${qs}`,
    )
      .then(async (res) => {
        const json = await res.json();
        if (!cancelled) {
          if (res.ok && json.ok) {
            setAssessment(json);
          }
          setAssessmentLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setAssessmentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, email, jobSlug]);

  const showAssessmentCta =
    assessment?.needsAssessment && assessment.status !== "completed";

  const shortId = applicationId
    ? applicationId.split("-")[0].toUpperCase()
    : "\u2014";
  const displayRef = referenceCode || shortId;

  return (
    <SiteLayout
      title="Application Received \u2014 SwiftJob"
      description="Thank you for applying to SwiftJob."
    >
      <div className="success-page-full">
        {/* Hero band — full width with image */}
        <div className="success-hero-band">
          <div className="success-hero-content">
            <CheckCircle
              size={48}
              strokeWidth={1.4}
              className="success-check"
            />
            <h1 className="success-h1">Application received</h1>
            <p className="success-sub">
              Thank you — your application for <strong>{position}</strong> has
              been securely received. Our recruitment team will carefully review
              your submission and contact you within{" "}
              <strong>3–5 business days</strong> regarding next steps. No
              further action is required at this time.
            </p>
            <div className="success-ref-pill">
              <span className="ref-label-sm">Reference</span>
              <code className="ref-code-sm">{displayRef}</code>
            </div>
          </div>
          <div className="success-hero-image">
            <img
              src="/wfh-desk.jpg"
              alt="Professional working remotely from home"
              loading="eager"
            />
          </div>
        </div>

        {/* Two-column body */}
        <div className="success-body-grid">
          {/* Left column — main content */}
          <main className="success-col-main">
            {/* Password card */}
            {applicationId && email && pwState !== "done" && (
              <section className="card-block">
                <div className="card-block-head">
                  <KeyRound size={18} />
                  <h3>Secure your candidate portal</h3>
                </div>
                <p className="card-block-desc">
                  Create a secure password for <strong>{email}</strong> to
                  access your candidate portal at your convenience — your magic
                  link will continue to work as a backup sign-in method.
                </p>
                {pwState === "error" && <p className="form-error">{pwMsg}</p>}
                <div className="password-row">
                  <input
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    disabled={pwState === "busy"}
                  />
                  <button
                    onClick={claimPassword}
                    disabled={pwState === "busy" || pw.length < 8}
                  >
                    {pwState === "busy" ? (
                      <Loader2 size={15} className="spin" />
                    ) : null}
                    Save
                  </button>
                </div>
              </section>
            )}
            {pwState === "done" && (
              <div className="password-done-banner">
                <ShieldCheck size={16} />
                <span>{pwMsg}</span> <Link href="/login">Sign in</Link>
              </div>
            )}

            {/* Skills check CTA */}
            {showAssessmentCta && (
              <section className="skills-cta-card">
                <ClipboardCheck size={24} />
                <div className="skills-cta-text">
                  <h3>Quick skills check (optional)</h3>
                  <p>
                    Boost your application — takes about 5\u20138 minutes. No
                    pass mark, no time limit.
                  </p>
                </div>
                <Link
                  href={`/assessment?id=${encodeURIComponent(applicationId)}&email=${encodeURIComponent(email)}&job=${encodeURIComponent(jobSlug)}`}
                >
                  Start now <ArrowRight size={14} />
                </Link>
              </section>
            )}

            {/* What happens next */}
            <section className="next-steps-section">
              <h2>What happens next</h2>
              <ol className="steps-list">
                {[
                  [
                    "01",
                    "Application Review",
                    "Our team reviews every application. Typically 3\u20135 business days.",
                  ],
                  [
                    "02",
                    "Skills Check",
                    "Complete the optional skills check above to strengthen your application.",
                  ],
                  [
                    "03",
                    "Team Review & Feedback",
                    "If your profile matches, we reach out directly by email \u2014 no interviews.",
                  ],
                  [
                    "04",
                    "Offer & Onboarding",
                    "Successful candidates receive a formal offer and fully remote onboarding.",
                  ],
                ].map(([num, title, copy]) => (
                  <li key={num}>
                    <span>{num}</span>
                    <div>
                      <strong>{title}</strong>
                      <p>{copy}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </main>

          {/* Right sidebar */}
          <aside className="success-col-side">
            <div className="side-card">
              <h4>Your Reference</h4>
              <code className="side-ref">{displayRef}</code>
              <p>Keep this handy for correspondence.</p>
            </div>
            <div className="side-card">
              <h4>Contact Recruitment</h4>
              <a href={`mailto:${CAREERS_EMAIL}`}>
                <Mail size={15} /> {CAREERS_EMAIL}
              </a>
            </div>
          </aside>
        </div>

        {/* Bottom actions */}
        <div className="success-bottom-actions">
          <Link href="/careers" className="btn btn-secondary">
            <ArrowLeft size={16} /> View all positions
          </Link>
          <Link href="/" className="btn btn-dark">
            Return to homepage <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}
