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

  // Portal password claim (optional — magic link always works too).
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

  // The real reference code (matches the confirmation email) when the apply
  // flow supplied it; older links fall back to a short id fragment.
  const shortId = applicationId
    ? applicationId.split("-")[0].toUpperCase()
    : "—";
  const displayRef = referenceCode || shortId;

  return (
    <SiteLayout
      title="Application Received — SwiftJob"
      description="Thank you for applying to SwiftJob. Your application has been received."
    >
      <div className="success-shell">
        <div className="success-card reveal is-visible">
          <div className="success-icon-wrap">
            <CheckCircle size={44} strokeWidth={1.5} />
          </div>

          <div className="success-eyebrow">APPLICATION RECEIVED</div>
          <h1 className="success-heading">
            Thank you for applying
            <br />
            <span>to SwiftJob.</span>
          </h1>

          <p className="success-lead">
            We have received your application for <strong>{position}</strong>{" "}
            and it is now under review by our recruitment team.
          </p>

          <div className="success-ref-box">
            <span className="success-ref-label">
              Your Application Reference
            </span>
            <span className="success-ref-id">{displayRef}</span>
          </div>

          {applicationId && email && (
            <div
              className="success-portal-claim"
              style={{
                margin: "18px auto 0",
                maxWidth: 460,
                border: "1px solid #dfe6dc",
                borderRadius: 14,
                padding: "18px 20px",
                background: "#fbfbf8",
                textAlign: "left",
              }}
            >
              <strong style={{ fontSize: 14.5, color: "#10251d" }}>
                Secure your candidate portal
              </strong>
              {pwState === "done" ? (
                <p
                  style={{
                    fontSize: 13.5,
                    color: "#2e7d43",
                    margin: "8px 0 0",
                  }}
                >
                  {pwMsg}{" "}
                  <a href="/login" style={{ fontWeight: 700 }}>
                    Sign in
                  </a>
                </p>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#66706a",
                      margin: "6px 0 12px",
                    }}
                  >
                    Set a password for <strong>{email}</strong> so you can sign
                    in without email links. Your email link still works as a
                    reset.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="password"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      placeholder="Create a password (8+ characters)"
                      style={{
                        flex: 1,
                        border: "1px solid #cfd6cf",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontSize: 14,
                      }}
                    />
                    <button
                      className="button button-blue"
                      onClick={claimPassword}
                      disabled={pwState === "busy"}
                    >
                      {pwState === "busy" ? (
                        <Loader2 size={15} className="spin" />
                      ) : null}
                      Save
                    </button>
                  </div>
                  {pwState === "error" && (
                    <p
                      style={{
                        fontSize: 12.5,
                        color: "#c43b3b",
                        margin: "8px 0 0",
                      }}
                    >
                      {pwMsg}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {assessmentLoading ? (
            <div className="assessment-cta-loading">
              <Loader2 size={16} className="spin" /> Checking your next steps…
            </div>
          ) : (
            showAssessmentCta && (
              <div className="assessment-cta-card">
                <div className="assessment-cta-icon">
                  <ClipboardCheck size={22} strokeWidth={1.6} />
                </div>
                <div className="assessment-cta-copy">
                  <strong>Quick skills check (optional)</strong>
                  <p>
                    Give your application a boost — a short{" "}
                    {assessment.jobTitle} skills check takes about 5–8 minutes.
                    No pass mark, no time limit.
                  </p>
                </div>
                <Link
                  className="button button-blue button-small"
                  href={`/assessment?id=${encodeURIComponent(applicationId)}&email=${encodeURIComponent(email)}&job=${encodeURIComponent(jobSlug)}`}
                >
                  Start now <ArrowRight size={14} />
                </Link>
              </div>
            )
          )}

          <div className="success-what-next">
            <h2>What happens next?</h2>
            <div className="success-steps">
              {[
                [
                  "01",
                  "Application review",
                  "Our recruitment team carefully reviews every application we receive. This typically takes 3–5 business days.",
                ],
                [
                  "02",
                  "Skills check",
                  "Complete the short optional skills check above — it takes 5–10 minutes and helps your application stand out.",
                ],
                [
                  "03",
                  "Feedback from our team",
                  "If your profile matches, we reach out directly by email with next steps — no calls to schedule, no interviews to prepare for.",
                ],
                [
                  "04",
                  "Offer & onboarding",
                  "Successful candidates receive a formal offer and are guided through a fully remote onboarding process.",
                ],
              ].map(([num, title, copy]) => (
                <div className="success-step" key={num}>
                  <span className="success-step-num">{num}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="success-contact-box">
            <Mail size={18} />
            <div>
              <p>
                If you would like to help our team identify your application
                more quickly, you are welcome to send a brief note to our
                recruitment team — including your reference number and the
                position you applied for.
              </p>
              <a href={`mailto:${CAREERS_EMAIL}`} className="success-email">
                {CAREERS_EMAIL} <ArrowUpRight size={14} />
              </a>
            </div>
          </div>

          <div className="success-actions">
            <Link href="/careers" className="button button-blue">
              <ArrowLeft size={16} /> View all positions
            </Link>
            <Link href="/" className="button button-dark">
              Return to homepage <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
