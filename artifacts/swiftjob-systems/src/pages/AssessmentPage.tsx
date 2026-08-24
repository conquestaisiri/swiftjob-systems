import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Clock,
  Loader2,
  Lock,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { trackEvent } from "@/lib/tracking";
import { deviceMeta } from "@/lib/deviceGuard";
import {
  TRACKS,
  scoreResponses,
  type AssessmentTrack,
} from "@/lib/assessmentTracks";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface LoadPayload {
  ok: boolean;
  applicationId: string;
  jobSlug: string;
  jobTitle: string;
  needsAssessment: boolean;
  track: AssessmentTrack;
  status: string;
  result: { score: number; maxScore: number; completedAt: string } | null;
}

type Step = "loading" | "intro" | "questions" | "submitting" | "done" | "error";

export function AssessmentPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const applicationId = params.get("id") ?? "";
  const email = params.get("email") ?? "";
  const jobSlug = params.get("job") ?? "";

  const [payload, setPayload] = useState<LoadPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<Step>("loading");
  const [answers, setAnswers] = useState<Record<string, number | undefined>>(
    {},
  );
  const [scenario, setScenario] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    completedAt: string;
  } | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    if (!applicationId || !email) {
      setLoadError(
        "This link is incomplete. Please open the full link you received by email.",
      );
      setStep("error");
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
          if (!res.ok) {
            setLoadError(json.error ?? "We could not load your assessment.");
            setStep("error");
            return;
          }
          setPayload(json);
          if (json.track === "none" || !json.needsAssessment) {
            setStep("done");
          } else if (json.status === "completed" && json.result) {
            setResult(json.result);
            setStep("done");
          } else {
            setStep("intro");
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            "We could not load your assessment right now. Please check your connection and try again.",
          );
          setStep("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, email, jobSlug]);

  const config = useMemo(
    () => (payload && payload.track !== "none" ? TRACKS[payload.track] : null),
    [payload],
  );

  const saveProgress = (next: Record<string, number | undefined>) => {
    setAnswers(next);
    try {
      sessionStorage.setItem(
        `swiftjob_assessment_${applicationId}`,
        JSON.stringify(next),
      );
    } catch {
      // Non-critical.
    }
  };

  const handleStart = () => {
    let stored: Record<string, number | undefined> = {};
    try {
      const raw = sessionStorage.getItem(
        `swiftjob_assessment_${applicationId}`,
      );
      if (raw) stored = JSON.parse(raw);
    } catch {
      // Ignore corrupt storage.
    }
    setAnswers(stored);
    setStep("questions");
  };

  const handleSubmit = async () => {
    if (!payload || !config) return;
    setStep("submitting");
    setSubmitError("");
    const { score, maxScore } = scoreResponses(config, answers);
    const responses = {
      mcq: answers,
      scenario: scenario.trim(),
    };
    try {
      const res = await fetch(
        `${API_BASE}/api/assessments/${encodeURIComponent(applicationId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            jobSlug: payload.jobSlug,
            systemCheck: { sentAt: new Date().toISOString(), ...deviceMeta() },
            responses,
            score,
            maxScore,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(
          json.error ?? "We could not save your assessment. Please try again.",
        );
        setStep("questions");
        return;
      }
      trackEvent("lead", {
        assessment: config.track,
        jobSlug: payload.jobSlug,
      });
      setResult({
        score: json.score,
        maxScore: json.maxScore,
        completedAt: json.completedAt,
      });
      setStep("done");
    } catch {
      setSubmitError(
        "Unable to connect. Please check your internet connection and try again.",
      );
      setStep("questions");
    }
  };

  if (step === "loading" || !payload) {
    return (
      <SiteLayout title="Assessment — SwiftJob">
        <div className="assessment-shell">
          <div className="assessment-card">
            <Loader2 size={34} className="spin" />
            <p className="assessment-loading-text">Loading your assessment…</p>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (step === "error") {
    return (
      <SiteLayout title="Assessment — SwiftJob">
        <div className="assessment-shell">
          <div className="assessment-card">
            <div className="assessment-icon-wrap assessment-icon-error">
              <Lock size={30} strokeWidth={1.6} />
            </div>
            <div className="assessment-eyebrow">ACCESS REQUIRED</div>
            <h1 className="assessment-heading">
              We could not verify this link
            </h1>
            <p className="assessment-lead">{loadError}</p>
            <div className="assessment-actions">
              <a href="/careers" className="button button-blue">
                <ArrowLeft size={16} /> Back to positions
              </a>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (step === "done") {
    const alreadyDone = result !== null;
    return (
      <SiteLayout
        title="Assessment — SwiftJob"
        description="Your skills check at SwiftJob."
      >
        <div className="assessment-shell">
          <div className="assessment-card">
            <div className="assessment-icon-wrap assessment-icon-done">
              <CheckCircle2 size={40} strokeWidth={1.6} />
            </div>
            <div className="assessment-eyebrow">
              {alreadyDone ? "ASSESSMENT RECORDED" : "NO ASSESSMENT REQUIRED"}
            </div>
            <h1 className="assessment-heading">
              {alreadyDone ? "Thank you — that's recorded" : "You're all set"}
            </h1>
            <p className="assessment-lead">
              {alreadyDone
                ? `Your skills check for ${payload.jobTitle} has been submitted successfully and attached to your application (${result?.score ?? 0}/${result?.maxScore ?? 0} multiple-choice questions answered correctly). Our recruitment team will review your application together with your results.`
                : `Your application for ${payload.jobTitle} does not need a skills check. Our recruitment team will review your application and contact you with the next steps.`}
            </p>
            <div className="assessment-note">
              <ShieldCheck size={18} />
              <span>
                Your answers are stored securely and only visible to the
                recruitment team.
              </span>
            </div>
            <div className="assessment-actions">
              <a href="/careers" className="button button-blue">
                View more positions
              </a>
              <a href="/" className="button button-dark">
                Return to homepage
              </a>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (step === "intro") {
    return (
      <SiteLayout
        title={`${config?.title} — SwiftJob`}
        description="A short skills check as part of your application."
      >
        <div className="assessment-shell">
          <div className="assessment-card">
            <div className="assessment-icon-wrap">
              <ClipboardCheck size={34} strokeWidth={1.6} />
            </div>
            <div className="assessment-eyebrow">SKILLS CHECK</div>
            <h1 className="assessment-heading">
              {config?.title}
              <br />
              <span>{payload.jobTitle}</span>
            </h1>
            <p className="assessment-lead">{config?.blurb}</p>
            <div className="assessment-meta-row">
              <span className="assessment-meta-chip">
                <Clock size={14} /> {config?.duration}
              </span>
              <span className="assessment-meta-chip">
                <ClipboardCheck size={14} />{" "}
                {config ? `${config.questions.length + 1} short questions` : ""}
              </span>
            </div>
            <div className="assessment-note">
              <ShieldCheck size={18} />
              <span>
                There is no pass mark and no time limit. Answer honestly — the
                goal is to help our team understand how you work.
              </span>
            </div>
            <div className="assessment-actions">
              <button className="button button-blue" onClick={handleStart}>
                Start assessment <ArrowRight size={16} />
              </button>
              <a href="/careers" className="button button-dark">
                Not now
              </a>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (!config) return null;

  const answered = config.questions.filter(
    (q) => answers[q.id] !== undefined,
  ).length;
  const allAnswered = answered === config.questions.length;
  // Progress reflects the required questions (the written scenario is
  // optional) so the bar can actually reach 100% when Submit unlocks.
  const progress = Math.round((answered / config.questions.length) * 100);

  return (
    <SiteLayout
      title={`${config.title} — SwiftJob`}
      description="A short skills check as part of your application."
    >
      <div className="assessment-shell">
        <div className="assessment-card assessment-quiz-card">
          <div className="assessment-quiz-head">
            <div>
              <div className="assessment-eyebrow">SKILLS CHECK</div>
              <h1 className="assessment-quiz-title">
                {config.title}
                <span>— {payload.jobTitle}</span>
              </h1>
            </div>
            <span className="assessment-progress-badge">
              {answered}/{config.questions.length}
            </span>
          </div>
          <div className="assessment-progress-track">
            <div
              className="assessment-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          {config.questions.map((q, qi) => (
            <div
              className="assessment-question"
              key={q.id}
              data-question-id={q.id}
            >
              <p className="assessment-question-prompt">
                <span className="assessment-q-num">{qi + 1}.</span>
                {q.prompt}
              </p>
              <div className="assessment-options">
                {q.options.map((opt, oi) => {
                  const selected = answers[q.id] === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      className={`assessment-option${selected ? " is-selected" : ""}`}
                      onClick={() => saveProgress({ ...answers, [q.id]: oi })}
                    >
                      <span className="assessment-option-key">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="assessment-question">
            <p className="assessment-question-prompt">
              <span className="assessment-q-num">
                {config.questions.length + 1}.
              </span>
              {config.scenario.prompt}
            </p>
            <textarea
              className="assessment-textarea"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder={config.scenario.placeholder}
              rows={6}
            />
          </div>

          {submitError && (
            <div className="assessment-submit-error">{submitError}</div>
          )}

          <div className="assessment-actions">
            <button
              className="button button-blue"
              disabled={!allAnswered || step === "submitting"}
              onClick={handleSubmit}
            >
              {step === "submitting" ? (
                <>
                  <Loader2 size={16} className="spin" /> Submitting…
                </>
              ) : (
                <>
                  Submit assessment <ArrowRight size={16} />
                </>
              )}
            </button>
            {!allAnswered && (
              <button
                className="button button-dark"
                onClick={() => {
                  // Scroll to the first UNANSWERED question, not question 1.
                  const firstUnanswered = config.questions.find(
                    (q) => answers[q.id] === undefined,
                  );
                  if (!firstUnanswered) return;
                  document
                    .querySelector(`[data-question-id="${firstUnanswered.id}"]`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                <RotateCcw size={15} /> Answer all questions to submit
              </button>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
