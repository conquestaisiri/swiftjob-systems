import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Clock,
  Linkedin,
  Globe,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  Lock,
  Video,
  CheckCircle2,
  Laptop,
  Smartphone,
  X,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { format } from "date-fns";
import { parseDateOnly } from "@/lib/utils";
import { analyzeDevice, deviceMeta } from "@/lib/deviceGuard";
import { NextStepFlow } from "@/components/NextStepFlow";
import { CandidatePasswordForm } from "@/components/CandidatePasswordForm";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function recordCandidateFootprint(
  token: string | null,
  applicationId: string,
  event: "visit" | "proceed" | "download" | "blocked" | "roomRevealed",
  attemptsLeft = 2,
) {
  if (!token) return;
  const device = analyzeDevice().verdict === "mobile" ? "mobile" : "laptop";
  fetch(`${API_BASE}/api/candidate/footprint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      applicationId,
      event,
      device,
      meta: deviceMeta(),
    }),
  }).catch(() => {
    if (attemptsLeft > 1) {
      setTimeout(
        () =>
          recordCandidateFootprint(
            token,
            applicationId,
            event,
            attemptsLeft - 1,
          ),
        1500,
      );
    }
  });
}

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-800",
  Reviewing: "bg-yellow-100 text-yellow-800",
  Shortlisted: "bg-purple-100 text-purple-800",
  Rejected: "bg-red-100 text-red-800",
  Hired: "bg-green-100 text-green-800",
};

function StatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        STATUS_COLORS[status] || "bg-gray-100 text-gray-800"
      } ${className}`}
    >
      {status === "Shortlisted" ? "Moved to next stage" : status}
    </span>
  );
}

interface Application {
  id: string;
  createdAt: string;
  position: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  timezone: string;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  yearsExperience: string;
  education: string;
  englishProficiency: string;
  noticePeriod: string;
  expectedSalary: string;
  earliestStartDate: string;
  skills: string;
  relevantExperience: string;
  coverLetter: string;
  roleAnswers?: { id: string; prompt: string; answer: string }[] | null;
  resumePath: string | null;
  resumeFilename: string | null;
  status: string;
  referenceCode: string;
  jobSlug?: string | null;
  techCheck?: {
    required: boolean;
    status: "not_started" | "in_progress" | "completed";
    checkedAt?: string | null;
    typingRequired?: boolean;
  };
  assessment?: {
    required: boolean;
    available: boolean;
    track: string;
    title: string | null;
    status: "locked" | "not_started" | "in_progress" | "completed";
    answered: number;
    total: number;
    score: number | null;
    maxScore: number | null;
    completedAt?: string | null;
    updatedAt?: string | null;
    blurb?: string;
    completedChecks?: number;
    totalChecks?: number;
  };
  meetLink: string | null;
  interviewInstructions: string | null;
  meetingKey: string | null;
  nextStep?: {
    backgroundUrl: string;
    roomLink: string;
    delaySeconds: number;
  };
}

interface CandidateResponse {
  applications: Application[];
}

const NEXT_STEPS: Record<
  string,
  { title: string; body: string; tone: "blue" | "green" | "gray" }
> = {
  New: {
    title: "Application received",
    body: "Our team has received your application and will review it shortly. If your profile matches the role, we'll reach out to arrange the next steps.",
    tone: "blue",
  },
  Reviewing: {
    title: "Your application is in review",
    body: "Our recruitment team is taking a closer look at your experience and skills against the role. The team aims to review applications within 2–3 business days — we'll email you when your status changes.",
    tone: "blue",
  },
  Shortlisted: {
    title: "You've moved to the next stage",
    body: "Your candidate portal shows the next step for this role. Complete the technical check if it is outstanding, then complete the role assessment if one is required.",
    tone: "green",
  },
  Rejected: {
    title: "Thank you for your interest",
    body: "After careful consideration, we've decided to move forward with other candidates whose profiles more closely match the role. Keep an eye on our careers page — we post new roles regularly and would welcome your application again in the future.",
    tone: "gray",
  },
  Hired: {
    title: "Welcome to the team!",
    body: "We're delighted to have you onboard. Our team will reach out shortly with your offer details, start date, and onboarding steps — watch your inbox.",
    tone: "green",
  },
};

export function CandidateApplications() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("candidate_token"),
  );
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
      return;
    }

    let cancelled = false;

    const fetchApplications = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_BASE}/api/candidate/applications`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          localStorage.removeItem("candidate_token");
          window.location.href = "/login";
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch applications");

        const data: CandidateResponse = await res.json();
        if (!cancelled) {
          setApplications(data.applications);
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load applications",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchApplications();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      localStorage.removeItem("candidate_token");
      window.location.href = "/login";
    } catch {
      setError("Could not sign out. Please check your connection and try again.");
      setSigningOut(false);
    }
  };

  const handleDownloadResume = async (application: Application) => {
    if (!application.resumePath) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/candidate/applications/${application.id}/resume`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to download");
      recordCandidateFootprint(token, application.id, "download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = application.resumeFilename || "resume.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download resume");
    }
  };

  if (!token) {
    return null; // Will redirect via useEffect
  }

  const countLabel = `${applications.length} application${
    applications.length !== 1 ? "s" : ""
  }`;

  return (
    <SiteLayout title="My Applications — SwiftJob">
      <div className="candidate-shell">
        <header className="candidate-header">
          <div className="container candidate-header-inner">
            <Link href="/" className="candidate-brand">
              <img
                src="/swiftjob-mark-light.png?v=supplied-20260912"
                alt="SwiftJob"
                className="candidate-logo"
              />
            </Link>
            <div className="candidate-header-actions">
              <span className="candidate-user">{countLabel}</span>
              <nav className="candidate-portal-nav" aria-label="Candidate portal">
                <Link href="/candidate/applications" className="active">Applications</Link>
                <Link href="/candidate/profile">Profile</Link>
                <Link href="/candidate/referrals">Referrals</Link>
              </nav>
              <button
                onClick={handleLogout}
                disabled={signingOut}
                className="button button-ghost button-sm"
              >
                <ArrowLeft size={14} /> {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </header>

        <main className="candidate-main">
          <div className="container">
            <div className="candidate-header-bar">
              <h1 className="candidate-title">My Applications</h1>
              <p className="candidate-subtitle">
                You have {countLabel}. Tap an application to see its full
                details and your next steps.
              </p>
            </div>

            <CandidatePasswordForm token={token} onSessionChanged={setToken} />

            {error && (
              <div className="candidate-alert" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="candidate-loading">
                <Loader2 size={32} className="animate-spin" />
                <p>Loading your applications...</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="candidate-empty">
                <FileText size={48} />
                <h3>No applications yet</h3>
                <p>You haven&apos;t applied to any positions yet.</p>
                <Link href="/careers" className="button button-blue">
                  Browse open positions <ArrowUpRight size={16} />
                </Link>
              </div>
            ) : selectedApp ? (
              <ApplicationDetail
                application={selectedApp}
                token={token}
                onBack={() => setSelectedApp(null)}
                onDownloadResume={() => handleDownloadResume(selectedApp)}
              />
            ) : (
              <div className="candidate-app-list">
                {applications.map((app) => (
                  <button
                    key={app.id}
                    className="candidate-app-card"
                    onClick={() => setSelectedApp(app)}
                  >
                    <div className="candidate-app-card-main">
                      <div className="position-title">{app.position}</div>
                      <div className="candidate-app-card-meta">
                        <span>Ref: {app.referenceCode}</span>
                        <span className="candidate-app-card-dot" />
                        <span>
                          Applied{" "}
                          {format(new Date(app.createdAt), "MMM d, yyyy")}
                        </span>
                        {app.city && app.country ? (
                          <>
                            <span className="candidate-app-card-dot" />
                            <span>
                              {app.city}, {app.country}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <StatusBadge status={app.status} />
                    <ChevronRight
                      size={18}
                      className="candidate-app-card-chevron"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </SiteLayout>
  );
}

function NextStepPanel({
  application,
  token,
}: {
  application: Application;
  token: string | null;
}) {
  const [flowOpen, setFlowOpen] = useState(false);

  if (
    application.status === "Shortlisted" &&
    (application.meetLink || application.nextStep?.roomLink)
  ) {
    const nextStep = application.nextStep;
    // When a room-level link is configured, reveal it after the configured
    // wait. The flow never performs a silent third-party request.
    const hasFlow = Boolean(nextStep?.roomLink);

    const handleOpenBriefing = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (hasFlow) {
        recordCandidateFootprint(token, application.id, "proceed");
        setFlowOpen(true);
        return;
      }
      recordCandidateFootprint(token, application.id, "proceed");
      window.open(application.meetLink as string, "_blank", "noreferrer");
    };

    return (
      <>
        <div className="next-step-panel next-step-panel--shortlist">
          <div className="next-step-icon">
            <Video size={22} />
          </div>
          <div className="next-step-body">
            <h3>
              {hasFlow
                ? "Your next step: your private room"
                : "Your next steps"}
            </h3>
            <p className="next-step-copy">
              Congratulations on being shortlisted!{" "}
              {hasFlow
                ? "Click the button below and your private room will be set up for you."
                : "Your official SwiftJob briefing is ready. Open it below and follow the instructions."}
            </p>
            <a
              href={application.meetLink ?? (hasFlow ? "#" : undefined)}
              onClick={handleOpenBriefing}
              target={application.meetLink ? "_blank" : undefined}
              rel="noreferrer"
              className="next-step-link"
            >
              {hasFlow ? (
                <>
                  Start your next step <ArrowUpRight size={16} />
                </>
              ) : (
                <>
                  Open your SwiftJob briefing <ArrowUpRight size={16} />
                </>
              )}
            </a>
                                  </div>
        </div>

        {hasFlow && nextStep && (
          <NextStepFlow
            open={flowOpen}
            onClose={() => setFlowOpen(false)}
            config={{
              backgroundUrl: nextStep.backgroundUrl,
              roomLink: nextStep.roomLink,
              delaySeconds: nextStep.delaySeconds,
            }}
            onRevealed={() =>
              recordCandidateFootprint(token, application.id, "roomRevealed")
            }
          />
        )}

      </>
    );
  }

  const step = NEXT_STEPS[application.status];
  if (!step) {
    return (
      <div className="next-step-panel next-step-panel--blue">
        <div className="next-step-icon">
          <Clock size={22} />
        </div>
        <div className="next-step-body">
          <h3>Your application is with our team</h3>
          <p className="next-step-copy">
            We'll email you as soon as your status changes. Keep an eye on your
            inbox (including spam/junk).
          </p>
        </div>
      </div>
    );
  }

  const icon =
    step.tone === "green" ? (
      <CheckCircle2 size={22} />
    ) : step.tone === "gray" ? (
      <FileText size={22} />
    ) : (
      <Clock size={22} />
    );

  return (
    <div className={`next-step-panel next-step-panel--${step.tone}`}>
      <div className="next-step-icon">{icon}</div>
      <div className="next-step-body">
        <h3>{step.title}</h3>
        <p className="next-step-copy">{step.body}</p>
      </div>
    </div>
  );
}

function CandidateChecksPanel({ application }: { application: Application }) {
  const techCheck = application.techCheck;
  const assessment = application.assessment;
  const assessmentUrl = `/assessment?id=${encodeURIComponent(application.id)}&email=${encodeURIComponent(application.email)}&ref=${encodeURIComponent(application.referenceCode)}&job=${encodeURIComponent(application.jobSlug ?? "")}`;

  if (!techCheck || techCheck.status !== "completed") {
    return (
      <div className="candidate-checks-panel candidate-checks-panel--required">
        <div className="candidate-checks-panel-icon"><Laptop size={22} /></div>
        <div className="candidate-checks-panel-body">
          <span className="candidate-checks-eyebrow">NEXT REQUIRED STEP</span>
          <h3>Complete your technical check</h3>
          <p>Confirm the computer, connection, and browser you plan to use for this application. If the recruitment team advances you, any role assessment will appear here as a separate next step.</p>
          <Link href={assessmentUrl} className="button button-blue">
            {techCheck?.status === "in_progress" ? "Continue your check" : "Complete your check"} <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  if (!assessment?.required) {
    return (
      <div className="candidate-checks-panel candidate-checks-panel--complete">
        <div className="candidate-checks-panel-icon"><CheckCircle2 size={22} /></div>
        <div className="candidate-checks-panel-body">
          <span className="candidate-checks-eyebrow">CHECKS COMPLETE</span>
          <h3>Your application checks are complete</h3>
          <p>Your technical check is attached to this application. Our team can now review it.</p>
          <span className="candidate-checks-progress">1 of 1 check complete</span>
        </div>
      </div>
    );
  }

  if (!assessment.available) {
    return (
      <div className="candidate-checks-panel">
        <div className="candidate-checks-panel-icon"><Lock size={22} /></div>
        <div className="candidate-checks-panel-body">
          <span className="candidate-checks-eyebrow">NEXT STAGE</span>
          <h3>Role assessment not unlocked yet</h3>
          <p>Your technical check is saved. The recruitment team will unlock the role-specific assessment if your application advances, and will email you when there is an update.</p>
          <span className="candidate-checks-progress">Technical check recorded</span>
        </div>
      </div>
    );
  }

  if (assessment.status === "completed") {
    return (
      <div className="candidate-checks-panel candidate-checks-panel--complete">
        <div className="candidate-checks-panel-icon"><CheckCircle2 size={22} /></div>
        <div className="candidate-checks-panel-body">
          <span className="candidate-checks-eyebrow">CHECKS COMPLETE</span>
          <h3>{assessment.title ?? "Role assessment"} completed</h3>
          <p>Your technical check and role assessment are attached to this application. Our team will review them with your application.</p>
          <span className="candidate-checks-progress">{assessment.completedChecks ?? 2} of {assessment.totalChecks ?? 2} checks complete</span>
        </div>
      </div>
    );
  }

  return (
    <div className="candidate-checks-panel">
      <div className="candidate-checks-panel-icon"><ClipboardCheck size={22} /></div>
      <div className="candidate-checks-panel-body">
        <span className="candidate-checks-eyebrow">NEXT REQUIRED STEP</span>
        <h3>Continue assessment</h3>
        <p>{assessment.title ?? "Your role assessment"}. {assessment.status === "in_progress" ? `Your saved progress is ${assessment.answered} of ${assessment.total} questions.` : "This assessment is matched to the work in this role."}</p>
        <span className="candidate-checks-progress">{assessment.completedChecks ?? 1} of {assessment.totalChecks ?? 2} checks complete</span>
        <Link href={assessmentUrl} className="button button-blue">
          Continue assessment <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

function ApplicationDetail({
  application,
  token,
  onBack,
  onDownloadResume,
}: {
  application: Application;
  token: string | null;
  onBack: () => void;
  onDownloadResume: () => void;
}) {
  useEffect(() => {
    recordCandidateFootprint(token, application.id, "visit");
  }, [application.id, token]);

  return (
    <div className="candidate-app-detail">
      <button onClick={onBack} className="candidate-back-btn">
        <ChevronLeft size={16} /> Back to my applications
      </button>

      <div className="candidate-detail-head">
        <div>
          <h2>{application.position}</h2>
          <p className="candidate-detail-sub">
            <span>Ref: {application.referenceCode}</span>
            <span className="candidate-app-card-dot" />
            <span>
              Applied {format(new Date(application.createdAt), "MMMM d, yyyy")}
            </span>
          </p>
        </div>
        <StatusBadge status={application.status} className="status-badge-lg" />
      </div>

      <NextStepPanel application={application} token={token} />

      <CandidateChecksPanel application={application} />

      <section className="candidate-detail-section">
        <h3>Contact &amp; background</h3>
        <div className="info-grid">
          <div className="info-item">
            <label>Email</label>
            <a href={`mailto:${application.email}`}>{application.email}</a>
          </div>
          <div className="info-item">
            <label>Phone</label>
            <a href={`tel:${application.phone}`}>{application.phone}</a>
          </div>
          <div className="info-item">
            <label>Location</label>
            <span>
              {application.city}, {application.country}
            </span>
          </div>
          <div className="info-item">
            <label>Timezone</label>
            <span>{application.timezone}</span>
          </div>
          <div className="info-item">
            <label>Experience</label>
            <span>{application.yearsExperience}</span>
          </div>
          <div className="info-item">
            <label>Education</label>
            <span>{application.education}</span>
          </div>
          <div className="info-item">
            <label>English</label>
            <span>{application.englishProficiency}</span>
          </div>
          <div className="info-item">
            <label>Notice Period</label>
            <span>{application.noticePeriod}</span>
          </div>
          <div className="info-item">
            <label>Expected Salary</label>
            <span>{application.expectedSalary}</span>
          </div>
          <div className="info-item">
            <label>Earliest Start</label>
            <span>
              {format(
                parseDateOnly(application.earliestStartDate),
                "MMM d, yyyy",
              )}
            </span>
          </div>
          {application.linkedinUrl && (
            <div className="info-item">
              <label>LinkedIn</label>
              <a
                href={application.linkedinUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Linkedin size={14} /> View Profile
              </a>
            </div>
          )}
          {application.portfolioUrl && (
            <div className="info-item">
              <label>Portfolio</label>
              <a
                href={application.portfolioUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Globe size={14} /> View Portfolio
              </a>
            </div>
          )}
        </div>
      </section>

      <section className="candidate-detail-section">
        <h3>Skills &amp; experience</h3>
        {application.roleAnswers?.length ? (
          <div className="detail-group">
            <h4>Your answers for this role</h4>
            {application.roleAnswers.map((item) => (
              <div className="application-role-answer" key={item.id}>
                <strong>{item.prompt}</strong>
                <p className="detail-text">{item.answer}</p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="detail-group">
          <h4>Skills</h4>
          <p className="detail-text">{application.skills}</p>
        </div>
        {application.relevantExperience?.trim() && (
          <div className="detail-group">
            <h4>Relevant Experience</h4>
            <p className="detail-text">{application.relevantExperience}</p>
          </div>
        )}
        {application.coverLetter?.trim() && (
          <div className="detail-group">
            <h4>Cover Letter</h4>
            <p className="detail-text">{application.coverLetter}</p>
          </div>
        )}
      </section>

      <section className="candidate-detail-section">
        <h3>Resume &amp; files</h3>
        {application.resumeFilename ? (
          <div className="resume-info">
            <FileText size={32} className="resume-icon" />
            <div>
              <h4>{application.resumeFilename}</h4>
              <p className="text-slate-500">Uploaded with application</p>
            </div>
            <button onClick={onDownloadResume} className="button button-blue">
              <Download size={16} /> Open Resume
            </button>
          </div>
        ) : (
          <div className="no-resume">
            <FileText size={48} className="text-slate-300" />
            <h4>No resume uploaded</h4>
            <p className="text-slate-500">
              You did not attach a resume file to this application.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
