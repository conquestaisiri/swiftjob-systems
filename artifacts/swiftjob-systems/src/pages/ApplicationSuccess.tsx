import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle,
  Mail,
  Lock,
  ArrowUpRight,
  ArrowLeft,
  ClipboardCheck,
  ArrowRight,
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
  assessmentTitle: string | null;
  assessmentBlurb: string;
  needsAssessment: boolean;
  assessmentRequired: boolean;
  assessmentAvailable: boolean;
  track: string;
  status: string;
  techCheck: {
    required: boolean;
    status: "not_started" | "in_progress" | "completed";
    typingRequired: boolean;
  };
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
    if (referenceCode) qs.set("ref", referenceCode);
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
  }, [applicationId, email, jobSlug, referenceCode]);

  const assessmentLink = `/assessment?id=${encodeURIComponent(applicationId)}&email=${encodeURIComponent(email)}&ref=${encodeURIComponent(referenceCode)}&job=${encodeURIComponent(jobSlug)}`;
  const showTechCheckCta = Boolean(
    assessment?.techCheck.required && assessment.techCheck.status !== "completed",
  );
  const showAssessmentCta = Boolean(
    assessment?.assessmentAvailable && assessment.assessmentRequired && assessment.needsAssessment &&
      assessment.techCheck.status === "completed",
  );

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
        {/* Text-only confirmation hero; no stock photo is used here. */}
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
              been securely received. Our recruitment team will review your
              submission and email you when there is an update. You can secure
              your candidate portal and complete the technical check there;
              any role assessment is unlocked only if the team advances your
              application.
            </p>
            <div className="success-ref-pill">
              <span className="ref-label-sm">Reference</span>
              <code className="ref-code-sm">{displayRef}</code>
            </div>
          </div>
        </div>

        {/* Two-column body */}
        <div className="success-body-grid">
          {/* Left column — main content */}
          <main className="success-col-main">
            {/* Password card */}
            {applicationId && email && (
              <section className="card-block">
                <div className="card-block-head">
                  <KeyRound size={18} />
                  <h3>Set up your candidate portal</h3>
                </div>
                <p className="card-block-desc">
                  Your application is saved. Verify access with a secure email
                  link using <strong>{email}</strong> to open your portal and
                  track this application. You can optionally create a password
                  after verifying your email.
                </p>
                <Link
                  href={`/login?email=${encodeURIComponent(email)}&from=application`}
                  className="button button-blue"
                >
                  Verify email and open portal
                </Link>
              </section>
            )}

            {/* Required technology check */}
            {showTechCheckCta && (
              <section className="skills-cta-card skills-cta-card--required">
                <ClipboardCheck size={24} />
                <div className="skills-cta-text">
                  <h3>Complete your technical check</h3>
                  <p>
                    Confirm the computer, connection, and browser you plan to
                    use for your {position} application. It takes about 2–3
                    minutes, and you can continue later.
                  </p>
                </div>
                <Link href={assessmentLink}>
                  Continue <ArrowRight size={14} />
                </Link>
              </section>
            )}

            {/* Role-specific assessment CTA */}
            {showAssessmentCta && (
              <section className="skills-cta-card">
                <ClipboardCheck size={24} />
                <div className="skills-cta-text">
                  <h3>{assessment?.assessmentTitle ?? `${position} assessment`}</h3>
                  <p>
                    This assessment is matched to the {position} role. It takes
                    about 5–10 minutes and can be continued later from your
                    portal.
                  </p>
                </div>
                <Link href={assessmentLink}>
                  Continue assessment <ArrowRight size={14} />
                </Link>
              </section>
            )}

            {assessment?.assessmentRequired && !assessment.assessmentAvailable && (
              <section className="skills-cta-card">
                <Lock size={22} />
                <div className="skills-cta-text">
                  <h3>Role assessment — available if you advance</h3>
                  <p>
                    The recruitment team will unlock the role-specific
                    assessment if your application moves to the next stage.
                    We’ll email you when it is available in your portal.
                  </p>
                </div>
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
                    "Our team aims to review applications within 2–3 business days and will email you when there is an update.",
                  ],
                  [
                    "02",
                    "Technical Check",
                    "Complete the required technical check so we can confirm your setup is ready for the role.",
                  ],
                  [
                    "03",
                    "Role Assessment",
                    "If this role uses an assessment, it becomes available in your portal only after the recruitment team advances your application.",
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
