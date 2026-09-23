import { useEffect, useMemo, useRef, useState } from "react";
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
  Laptop,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { trackEvent } from "@/lib/tracking";
import { analyzeDevice, deviceMeta, useDeviceGuard } from "@/lib/deviceGuard";
import { PreChecks, type PreCheckResult } from "@/components/PreChecks";
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
  assessmentTitle: string | null;
  assessmentBlurb: string;
  needsAssessment: boolean;
  assessmentRequired: boolean;
  track: AssessmentTrack;
  status: string;
  techCheck: {
    required: boolean;
    status: "not_started" | "in_progress" | "completed";
    typingRequired: boolean;
  };
  draft: {
    responses: { mcq?: Record<string, number>; scenario?: string } | null;
    systemCheck: PreCheckResult | Record<string, unknown> | null;
    updatedAt: string;
  } | null;
  result: { score: number; maxScore: number; completedAt: string } | null;
}

type Step =
  | "loading"
  | "intro"
  | "checks"
  | "questions"
  | "submitting"
  | "done"
  | "error";

interface DraftSave {
  answers: Record<string, number | undefined>;
  scenario: string;
  systemCheck: unknown;
}

export function AssessmentPage() {
  const { status: deviceStatus } = useDeviceGuard();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const applicationId = params.get("id") ?? "";
  const email = params.get("email") ?? "";
  const jobSlug = params.get("job") ?? "";
  const referenceCode = params.get("ref") ?? "";

  const [payload, setPayload] = useState<LoadPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<Step>("loading");
  const precheckRef = useRef<PreCheckResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | undefined>>(
    {},
  );
  const [scenario, setScenario] = useState("");
  const draftSaveTimerRef = useRef<number | null>(null);
  const pendingDraftSaveRef = useRef<DraftSave | null>(null);
  const draftSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
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
    if (referenceCode) qs.set("ref", referenceCode);
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
          if (json.draft?.systemCheck) {
            precheckRef.current = json.draft.systemCheck as PreCheckResult;
          }
          if (json.techCheck?.status !== "completed") {
            setStep("intro");
          } else if (json.track === "none" || !json.needsAssessment) {
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
  }, [applicationId, email, jobSlug, referenceCode]);

  const config = useMemo(
    () => (payload && payload.track !== "none" ? TRACKS[payload.track] : null),
    [payload],
  );
  const roleAssessmentTitle =
    payload?.assessmentTitle ?? config?.title ?? "Role assessment";

  const enqueueDraftSave = (draft: DraftSave): Promise<void> => {
    if (!payload || !referenceCode) return Promise.resolve();
    draftSaveQueueRef.current = draftSaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await fetch(
            `${API_BASE}/api/assessments/${encodeURIComponent(applicationId)}/draft`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email,
                referenceCode,
                jobSlug: payload.jobSlug,
                systemCheck: draft.systemCheck,
                responses: { mcq: draft.answers, scenario: draft.scenario },
              }),
            },
          );
        } catch {
          // The local session draft remains available if the network is down.
        }
      });
    return draftSaveQueueRef.current;
  };

  const scheduleDraftSave = (
    nextAnswers: Record<string, number | undefined>,
    nextScenario = scenario,
    systemCheck: unknown = precheckRef.current ?? {},
  ) => {
    pendingDraftSaveRef.current = {
      answers: nextAnswers,
      scenario: nextScenario,
      systemCheck,
    };
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = window.setTimeout(() => {
      draftSaveTimerRef.current = null;
      const pending = pendingDraftSaveRef.current;
      pendingDraftSaveRef.current = null;
      if (pending) void enqueueDraftSave(pending);
    }, 450);
  };

  const flushPendingDraftSave = async () => {
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    const pending = pendingDraftSaveRef.current;
    pendingDraftSaveRef.current = null;
    if (pending) await enqueueDraftSave(pending);
    await draftSaveQueueRef.current;
  };

  const saveProgress = (next: Record<string, number | undefined>, nextScenario = scenario) => {
    setAnswers(next);
    try {
      sessionStorage.setItem(
        `swiftjob_assessment_${applicationId}`,
        JSON.stringify({ mcq: next, scenario: nextScenario }),
      );
    } catch {
      // Non-critical.
    }
    scheduleDraftSave(next, nextScenario);
  };

  const handleStart = () => {
    if (!payload) return;
    let stored: { mcq: Record<string, number | undefined>; scenario: string } = {
      mcq: {},
      scenario: "",
    };
    if (payload.draft?.responses) {
      stored = {
        mcq: payload.draft.responses.mcq ?? {},
        scenario: payload.draft.responses.scenario ?? "",
      };
    }
    try {
      const raw = sessionStorage.getItem(
        `swiftjob_assessment_${applicationId}`,
      );
      if (raw && !payload.draft) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        stored = parsed.mcq
          ? {
              mcq: parsed.mcq as Record<string, number | undefined>,
              scenario: typeof parsed.scenario === "string" ? parsed.scenario : "",
            }
          : { mcq: parsed as Record<string, number | undefined>, scenario: "" };
      }
    } catch {
      // Ignore corrupt storage.
    }
    setAnswers(stored.mcq);
    setScenario(stored.scenario);
    if (payload.techCheck.status === "completed") {
      setStep(payload.status === "completed" || !config ? "done" : "questions");
    } else {
      setStep("checks");
    }
  };

  const handleSubmit = async () => {
    if (!payload || !config) return;
    setStep("submitting");
    setSubmitError("");
    await flushPendingDraftSave();
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
            referenceCode,
            jobSlug: payload.jobSlug,
            systemCheck: {
              sentAt: new Date().toISOString(),
              ...deviceMeta(),
              ...(precheckRef.current ?? {}),
            },
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

  const computerRequired =
    step === "checks" ||
    step === "intro" ||
    step === "questions" ||
    step === "submitting";
  if (computerRequired && deviceStatus !== "desktop") {
    const title = deviceStatus === "checking"
      ? "Checking this device"
      : "Continue on a computer";
    const message = deviceStatus === "checking"
      ? "Confirming this device before we open your required check."
      : "Complete this required step on the laptop or desktop you plan to use for the role. Browser device checks are best-effort and may not identify every phone using desktop-site mode.";
    return (
      <SiteLayout
        title={`${title} — SwiftJob`}
        description="This required application step needs a laptop or desktop computer."
      >
        <div className="assessment-shell">
          <div
            className="assessment-card"
            style={{ maxWidth: 560, textAlign: "center" }}
          >
            <div
              className="assessment-icon-wrap"
              style={{ margin: "0 auto 20px" }}
            >
              <Laptop size={34} strokeWidth={1.6} />
            </div>
            <div className="assessment-eyebrow">COMPUTER REQUIRED</div>
            <h1 className="assessment-heading" style={{ textAlign: "center" }}>
              {title}
            </h1>
            <p className="assessment-lead" style={{ textAlign: "center" }}>
              {message}
            </p>
            {deviceStatus === "mobile" && (
              <div className="assessment-actions" style={{ justifyContent: "center" }}>
                <a href="/login" className="button button-blue">
                  Return to candidate portal
                </a>
              </div>
            )}
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
              <a href="/login" className="button button-blue">
                Sign in to your candidate portal <ArrowRight size={16} />
              </a>
              <a href="/careers" className="button button-blue">
                <ArrowLeft size={16} /> Back to positions
              </a>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

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

  if (step === "done") {
    const alreadyDone = result !== null;
    const techOnlyDone = !alreadyDone && !payload.assessmentRequired;
    return (
      <SiteLayout
        title="Assessment — SwiftJob"
        description="Your SwiftJob technology check and role assessment."
      >
        <div className="assessment-shell">
          <div className="assessment-card">
            <div className="assessment-icon-wrap assessment-icon-done">
              <CheckCircle2 size={40} strokeWidth={1.6} />
            </div>
            <div className="assessment-eyebrow">
              {alreadyDone ? "ASSESSMENT COMPLETED" : techOnlyDone ? "TECHNICAL CHECK COMPLETED" : "NO ASSESSMENT REQUIRED"}
            </div>
            <h1 className="assessment-heading">
              {alreadyDone ? "Thank you — your assessment is complete" : techOnlyDone ? "Your required technical check is complete" : "You're all set"}
            </h1>
            <p className="assessment-lead">
              {alreadyDone
                ? `Your ${roleAssessmentTitle} has been submitted successfully and attached to your application. You answered ${result?.score ?? 0} of ${result?.maxScore ?? 0} multiple-choice questions correctly. Our recruitment team will review your application together with your results.`
                : techOnlyDone
                  ? `Your required technical check for ${payload.jobTitle} has been recorded. This role does not use a separate role assessment, so our recruitment team can now review your application.`
                  : `Your application for ${payload.jobTitle} does not need a role assessment. Our recruitment team will review your application and contact you with the next steps.`}
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
              <a href="/login" className="button button-dark">
                Return to candidate portal
              </a>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (step === "checks") {
    return (
      <SiteLayout
        title={`${config?.title ?? "Required technical check"} — SwiftJob`}
        description="Required technical check for your SwiftJob application."
      >
        <div className="assessment-shell">
          <PreChecks
            applicationId={applicationId}
            email={email}
            referenceCode={referenceCode}
            jobTitle={payload.jobTitle}
            typingRequired={payload.techCheck.typingRequired}
            onComplete={(result) => {
              precheckRef.current = result;
              void enqueueDraftSave({ answers, scenario, systemCheck: result });
              setPayload((current) =>
                current
                  ? {
                      ...current,
                      techCheck: { ...current.techCheck, status: "completed" },
                    }
                  : current,
              );
              if (payload.result) {
                setResult(payload.result);
                setStep("done");
              } else if (payload.assessmentRequired && config) {
                setStep("questions");
              } else {
                setStep("done");
              }
            }}
          />
        </div>
      </SiteLayout>
    );
  }

  if (step === "intro") {
    const techCheckPending = payload.techCheck.status !== "completed";
    const introTitle = techCheckPending
      ? "Complete your technical check"
      : roleAssessmentTitle;
    const introBlurb = techCheckPending
      ? `For your ${payload.jobTitle} application, confirm that your connection, browser, and computer are ready. This usually takes 2–3 minutes.`
      : (payload.assessmentBlurb || config?.blurb || "A short assessment matched to the work in this role.");
    const isMobile = analyzeDevice().verdict === "mobile";
    if (isMobile) {
      return (
        <SiteLayout
          title={`${introTitle} — SwiftJob`}
          description="A role-matched assessment as part of your application."
        >
          <div className="assessment-shell">
            <div
              className="assessment-card"
              style={{ maxWidth: 560, textAlign: "center" }}
            >
              <div
                className="assessment-icon-wrap"
                style={{ margin: "0 auto 20px" }}
              >
                <Laptop size={34} strokeWidth={1.6} />
              </div>
              <div className="assessment-eyebrow">{techCheckPending ? "REQUIRED TECHNICAL CHECK" : "ROLE ASSESSMENT"}</div>
              <h1
                className="assessment-heading"
                style={{ textAlign: "center" }}
              >
                {introTitle}
                <br />
                <span>{techCheckPending ? "the next required step" : "matched to this role"}</span>
              </h1>
              <p className="assessment-lead" style={{ textAlign: "center" }}>
                {techCheckPending
                  ? "Complete this check on the computer you plan to use for the role. You can stop after this step and continue later from your candidate portal."
                  : "This role assessment is matched to the work. It takes about 5–10 minutes, and your progress is saved as you go."}
              </p>
              <div
                className="assessment-actions"
                style={{ justifyContent: "center" }}
              >
                <a href="/login" className="button button-blue">
                  Back to candidate sign-in
                </a>
              </div>
            </div>
          </div>
        </SiteLayout>
      );
    }
    return (
      <SiteLayout
        title={`${introTitle} — SwiftJob`}
        description="A role-matched assessment as part of your application."
      >
        <div
          className="assessment-page-full"
          style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px 80px" }}
        >
          <div className="assessment-hero-band">
            <div className="assessment-hero-content">
              <div className="assessment-eyebrow" style={{ color: "#d4e94e" }}>
                {techCheckPending ? "REQUIRED TECHNICAL CHECK" : "ROLE ASSESSMENT"}
              </div>
              <h1
                className="assessment-heading"
                style={{ color: "#fff", margin: "0 0 14px" }}
              >
                {introTitle}
                <span
                  style={{
                    color: "#d4e94e",
                    display: "block",
                    fontSize: "0.55em",
                    marginTop: 8,
                  }}
                >
                  {payload.jobTitle}
                </span>
              </h1>
              <p
                className="assessment-lead"
                style={{ color: "#c8d5cc", marginBottom: 18 }}
              >
                {introBlurb}
              </p>
              <div className="assessment-meta-row">
                <span
                  className="assessment-meta-chip"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    borderColor: "rgba(255,255,255,0.15)",
                    color: "#fff",
                  }}
                >
                  <Clock size={14} /> {techCheckPending ? "About 2–3 minutes" : config?.duration}
                </span>
                <span
                  className="assessment-meta-chip"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    borderColor: "rgba(255,255,255,0.15)",
                    color: "#fff",
                  }}
                >
                  <ClipboardCheck size={14} />{" "}
                  {techCheckPending ? "Required next step" : config ? `${config.questions.length + 1} questions` : ""}
                </span>
              </div>
              <div
                className="assessment-note"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  borderColor: "rgba(255,255,255,0.12)",
                  color: "#c8d5cc",
                }}
              >
                <ShieldCheck size={18} />
                <span>
                  {techCheckPending
                    ? "This check is mandatory before we can move your application forward. On Windows, the checker runs first, then opens a separate installer for you to review. Your report is sent only after the installer completes."
                    : "There is no pass mark and no time limit. Answer honestly — the goal is to help our team understand how you work."}
                </span>
              </div>
              <div className="assessment-actions" style={{ marginTop: 20 }}>
                <button
                  className="button button-mint"
                  onClick={handleStart}
                  style={{
                    background: "#d4e94e",
                    color: "#10251d",
                    fontWeight: 700,
                  }}
                >
                  {techCheckPending ? "Complete your check" : "Continue assessment"} <ArrowRight size={16} />
                </button>
                <a
                  href="/careers"
                  className="button button-dark"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                  }}
                >
                  Return to candidate portal
                </a>
              </div>
            </div>
            <div className="assessment-hero-image">
              <img
                src="/wfh-dev.jpg"
                alt="Developer working remotely at home desk with multiple monitors"
                loading="eager"
              />
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
      description="A role-matched assessment as part of your application."
    >
      <div className="assessment-shell">
        <div className="assessment-card assessment-quiz-card">
          <div className="assessment-quiz-head">
            <div>
              <div className="assessment-eyebrow">ROLE ASSESSMENT</div>
              <h1 className="assessment-quiz-title">
                {roleAssessmentTitle}
                <span>— {payload.jobTitle}</span>
              </h1>
            </div>
            <span className="assessment-progress-badge">
              {answered} of {config.questions.length} questions answered
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
              onChange={(e) => {
                const nextScenario = e.target.value;
                setScenario(nextScenario);
                try {
                  sessionStorage.setItem(
                    `swiftjob_assessment_${applicationId}`,
                    JSON.stringify({ mcq: answers, scenario: nextScenario }),
                  );
                } catch {
                  // Non-critical.
                }
                scheduleDraftSave(answers, nextScenario);
              }}
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
