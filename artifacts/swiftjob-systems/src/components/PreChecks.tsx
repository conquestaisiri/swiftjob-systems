import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Gauge,
  Keyboard,
  Loader2,
  MonitorSmartphone,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { formatSystemSpecEntries } from "@/lib/systemSpecs";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface PreCheckResult {
  speed: {
    downMbps: number | null;
    upMbps: number | null;
    pingMs: number | null;
  };
  browser: Record<string, unknown>;
  tool: {
    platform: "windows" | "macos" | "other";
    verified: boolean;
    specs: Record<string, unknown> | null;
  };
  typing: { wpm: number; accuracyPct: number; seconds: number } | null;
}

type Stage = "speed" | "system" | "typing";

const TYPING_PASSAGE =
  "Working remotely means clear communication and steady focus. You read carefully, you type what you mean, and you finish what you start. At SwiftJob we look for people who take pride in doing simple things accurately, every single day, because small details done well are what keep our clients happy.";

const TYPING_SECONDS = 60;

function fmtMbps(v: number): string {
  return v >= 100 ? Math.round(v).toString() : v.toFixed(1);
}

async function measurePing(): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    await fetch(`${API_BASE}/api/healthz`, { cache: "no-store" });
    samples.push(performance.now() - t0);
  }
  return Math.round(samples.sort((a, b) => a - b)[1]);
}

export function PreChecks({
  applicationId,
  email,
  referenceCode,
  jobTitle,
  typingRequired,
  techCheckStatus,
  onComplete,
}: {
  applicationId: string;
  email: string;
  referenceCode: string;
  jobTitle: string;
  typingRequired: boolean;
  techCheckStatus: "not_started" | "in_progress" | "completed";
  onComplete: (result: PreCheckResult) => void;
}) {
  const [stage, setStage] = useState<Stage>("speed");

  // ---- speed ----
  const [speedRunning, setSpeedRunning] = useState(true);
  const [downMbps, setDownMbps] = useState<number | null>(null);
  const [upMbps, setUpMbps] = useState<number | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);

  const runSpeedCheck = useCallback(async () => {
    setSpeedRunning(true);
    setDownMbps(null);
    setUpMbps(null);
    setPingMs(null);
    try {
      const ping = await measurePing();
      const asset = `${API_BASE}/swiftjob-og.png`;
      const batches: Promise<unknown>[] = [];
      const t0 = performance.now();
      let bytes = 0;
      for (let b = 0; b < 4; b++) {
        batches.push(
          Promise.all(
            Array.from({ length: 10 }, (_, i) =>
              fetch(`${asset}?cb=${Date.now()}-${b}-${i}`, {
                cache: "no-store",
              })
                .then((r) => r.arrayBuffer())
                .then((buf) => {
                  bytes += buf.byteLength;
                }),
            ),
          ),
        );
      }
      await Promise.all(batches);
      const secs = (performance.now() - t0) / 1000;
      const mbps = (bytes * 8) / 1e6 / secs;
      // Upload: POST a ~1 MB random blob, twice, take the better run.
      const blob = new Blob(
        [
          new Uint8Array(1024 * 1024).map(() =>
            Math.floor(Math.random() * 256),
          ),
        ],
        { type: "application/octet-stream" },
      );
      let up = 0;
      for (let run = 0; run < 2; run++) {
        const u0 = performance.now();
        await fetch(`${API_BASE}/api/tech-check/upload`, {
          method: "POST",
          body: blob,
          cache: "no-store",
        });
        const usecs = (performance.now() - u0) / 1000;
        up = Math.max(up, (1024 * 1024 * 8) / 1e6 / usecs);
      }
      setPingMs(ping);
      setDownMbps(Math.max(0.1, Math.min(2000, mbps)));
      setUpMbps(Math.max(0.1, Math.min(2000, up)));
    } catch {
      setDownMbps(-1); // signal failure
      setUpMbps(-1);
    } finally {
      setSpeedRunning(false);
    }
  }, []);

  useEffect(() => {
    void runSpeedCheck();
  }, [runSpeedCheck]);

  // ---- system / tool ----
  const ua = navigator.userAgent;
  const platform: "windows" | "macos" | "other" = useMemo(() => {
    if (/Windows/i.test(ua)) return "windows";
    if (/Macintosh|Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua))
      return "macos";
    return "other";
  }, [ua]);

  const browserSpecs = useMemo(
    () => ({
      cpuCores:
        (navigator as unknown as { hardwareConcurrency?: number })
          .hardwareConcurrency ?? null,
      memoryGB:
        (navigator as unknown as { deviceMemory?: number }).deviceMemory ??
        null,
      screenWidth: window.screen?.width ?? null,
      screenHeight: window.screen?.height ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      language: navigator.language ?? null,
    }),
    [],
  );

  const [token, setToken] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<Date | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [toolError, setToolError] = useState("");
  const [verifying, setVerifying] = useState(techCheckStatus === "in_progress");
  const [downloaded, setDownloaded] = useState(techCheckStatus === "in_progress");
  const [toolRunState, setToolRunState] = useState<"idle" | "waiting" | "running" | "expired" | "complete">
    (techCheckStatus === "in_progress" ? "waiting" : "idle");
  const [toolVerified, setToolVerified] = useState(false);
  const [toolSpecs, setToolSpecs] = useState<Record<string, unknown> | null>(
    null,
  );
  const [statusClock, setStatusClock] = useState(Date.now());
  const systemAutoAdvanceRef = useRef(false);
  const completionStartedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const issueToken = useCallback(async () => {
    setIssuing(true);
    setToolError("");
    try {
      const res = await fetch(`${API_BASE}/api/tech-check/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, email, referenceCode }),
        cache: "no-store",
      });
      const data = await res.json();
      if (res.status === 409 && data.inProgress) {
        setToken(null);
        setDownloaded(true);
        setToolRunState("running");
        setToolError("");
        return null;
      }
      if (!res.ok || !data.ok)
        throw new Error(data.error || "Could not prepare the checker.");
      setToken(data.token as string);
      setTokenExpiry(new Date(data.expiresAt as string));
      return data.token as string;
    } catch (err) {
      setToolError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      return null;
    } finally {
      setIssuing(false);
    }
  }, [applicationId, email, referenceCode]);

  const downloadTool = async () => {
    if (platform === "other") {
      setToolError(
        `This system checker is not available for this device. Please contact ${SUPPORT_EMAIL} for help.`,
      );
      return;
    }
    setToolError("");
    const downloadWindow = window.open("about:blank", "_blank");
    // The API issues a single-file package using a one-time token.
    const issuedToken = await issueToken();
    if (!issuedToken) {
      downloadWindow?.close();
      return;
    }
    const checkerPlatform = platform === "macos" ? "macos" : "windows";
    const downloadUrl = `${API_BASE}/api/tech-check/download/${encodeURIComponent(issuedToken)}?platform=${checkerPlatform}`;
    if (downloadWindow && !downloadWindow.closed)
      downloadWindow.location.replace(downloadUrl);
    else window.location.assign(downloadUrl);
    setToolRunState("waiting");
    setDownloaded(true);
  };

  // Poll automatically after download (or after resuming an in-progress
  // application). Before launch, check slowly; once the installer starts,
  // check every five seconds until its server-issued ten-minute deadline.
  useEffect(() => {
    if (!downloaded || toolVerified || toolRunState === "expired") return;
    let cancelled = false;
    let stopPolling = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;

    const poll = async () => {
      controller = new AbortController();
      let nextDelay = 15_000;
      try {
        const statusUrl = token
          ? `${API_BASE}/api/tech-check/status/${encodeURIComponent(token)}`
          : `${API_BASE}/api/tech-check/application-status`;
        const response = await fetch(statusUrl, token
          ? {
              cache: "no-store",
              signal: controller.signal,
            }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ applicationId, email, referenceCode }),
              cache: "no-store",
              signal: controller.signal,
            });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Could not read checker status.");
        }
        if (cancelled) return;

        if ((data.used || data.status === "completed") && data.specs) {
          stopPolling = true;
          setToolVerified(true);
          setToolSpecs(data.specs as Record<string, unknown>);
          setToolRunState("complete");
          setToolError("");
          setVerifying(false);
          return;
        }

        if (data.expired || data.valid === false) {
          stopPolling = true;
          setToolRunState("expired");
          setToolError(
            data.startedAt
              ? "The ten-minute installation window expired before a successful report arrived. Request a fresh checker to try again."
              : "The checker link expired before it was started. Download a fresh checker to continue.",
          );
          setVerifying(false);
          return;
        }

        const hasStarted = Boolean(data.startedAt);
        setToolRunState(hasStarted ? "running" : "waiting");
        setTokenExpiry(data.expiresAt ? new Date(data.expiresAt) : null);
        setToolError("");
        setVerifying(true);
        nextDelay = hasStarted ? 5_000 : 20_000;
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        setToolError("We’re still checking for the report. This page will retry automatically.");
        nextDelay = toolRunState === "running" ? 5_000 : 15_000;
        setVerifying(true);
      } finally {
        if (!cancelled && !stopPolling) timer = window.setTimeout(poll, nextDelay);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      controller?.abort();
    };
  }, [applicationId, email, referenceCode, token, downloaded, toolVerified, toolRunState]);

  useEffect(() => {
    if (toolRunState !== "running") return;
    const id = window.setInterval(() => setStatusClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [toolRunState]);

  // ---- typing ----
  const [typed, setTyped] = useState("");
  const [typedStartedAt, setTypedStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [typingDone, setTypingDone] = useState(false);
  const [typingStats, setTypingStats] = useState<{
    wpm: number;
    accuracyPct: number;
    seconds: number;
  } | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!typedStartedAt || typingDone) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [typedStartedAt, typingDone]);

  useEffect(() => {
    if (
      typedStartedAt &&
      !typingDone &&
      (nowTick - typedStartedAt) / 1000 >= TYPING_SECONDS
    ) {
      finishTyping();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick, typedStartedAt, typingDone]);

  const elapsedSec = typedStartedAt
    ? Math.min(
        TYPING_SECONDS,
        typingDone && typingStats
          ? TYPING_SECONDS
          : (nowTick - typedStartedAt) / 1000,
      )
    : 0;

  const computeAccuracy = (text: string) => {
    let correct = 0;
    const min = Math.min(text.length, TYPING_PASSAGE.length);
    for (let i = 0; i < min; i++) if (text[i] === TYPING_PASSAGE[i]) correct++;
    return correct;
  };

  const finishTyping = () => {
    if (typingDone) return;
    const seconds = typedStartedAt
      ? Math.max(
          1,
          Math.min(TYPING_SECONDS, (Date.now() - typedStartedAt) / 1000),
        )
      : TYPING_SECONDS;
    const correct = computeAccuracy(typed);
    const wpm = Math.round(correct / 5 / (seconds / 60));
    const accuracyPct = typed.length
      ? Math.round((correct / Math.max(typed.length, 1)) * 100)
      : 0;
    setTypingDone(true);
    setTypingStats({ wpm, accuracyPct, seconds });
  };

  const onType = (value: string) => {
    if (typingDone) return;
    if (!typedStartedAt) setTypedStartedAt(Date.now());
    setTyped(value.slice(0, TYPING_PASSAGE.length + 80));
  };

  const completeTechnicalCheck = useCallback(
    (typing: PreCheckResult["typing"]) => {
      if (completionStartedRef.current) return;
      completionStartedRef.current = true;
      onCompleteRef.current({
        speed: { downMbps, upMbps, pingMs },
        browser: browserSpecs,
        tool: {
          platform,
          verified: toolVerified,
          specs: toolSpecs,
        },
        typing,
      });
    },
    [downMbps, upMbps, pingMs, browserSpecs, platform, toolVerified, toolSpecs],
  );

  // ---- completion ----
  useEffect(() => {
    if (stage !== "system" || !toolVerified || systemAutoAdvanceRef.current) return;
    const id = window.setTimeout(() => {
      if (systemAutoAdvanceRef.current) return;
      systemAutoAdvanceRef.current = true;
      if (typingRequired) setStage("typing");
      else completeTechnicalCheck(null);
    }, 3500);
    return () => window.clearTimeout(id);
  }, [stage, toolVerified, typingRequired, completeTechnicalCheck]);

  useEffect(() => {
    if (!(stage === "typing" && typingDone && typingStats)) return;
    // Auto-advance shortly after showing the result.
    const id = window.setTimeout(() => {
      completeTechnicalCheck(typingStats);
    }, 1400);
    return () => window.clearTimeout(id);
  }, [
    stage,
    typingDone,
    typingStats,
    completeTechnicalCheck,
  ]);

  const Row = ({
    ok,
    children,
  }: {
    ok: boolean | null;
    children: React.ReactNode;
  }) => (
    <li
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontSize: 14,
        color: "#37413b",
      }}
    >
      {ok === null ? (
        <Loader2 size={17} className="spin" style={{ flexShrink: 0 }} />
      ) : ok ? (
        <CheckCircle2 size={17} color="#2e7d43" style={{ flexShrink: 0 }} />
      ) : (
        <XCircle size={17} color="#c43b3b" style={{ flexShrink: 0 }} />
      )}
      <span>{children}</span>
    </li>
  );

  const stages: Stage[] = typingRequired
    ? ["speed", "system", "typing"]
    : ["speed", "system"];
  const systemSpecEntries = formatSystemSpecEntries(toolSpecs);

  return (
    <div className="assessment-card">
      <div className="assessment-icon-wrap">
        <Gauge size={34} strokeWidth={1.6} />
      </div>
      <div className="assessment-eyebrow">REQUIRED TECHNICAL CHECK</div>
      <h1 className="assessment-heading">
        Complete your technical check
        <br />
        <span>for your {jobTitle} application</span>
      </h1>
      <p className="assessment-lead">
        Confirm that your connection, browser, and computer are ready for this
        role. This step is mandatory before we can move your application forward.
      </p>

      {/* Stage indicator */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          margin: "18px 0 22px",
        }}
      >
        {stages.map((s, i) => {
          const active = s === stage;
          const done =
            (s === "speed" &&
              ["system", "typing"].includes(stage) &&
              downMbps !== null) ||
            (s === "system" && stage === "typing");
          return (
            <span
              key={s}
              style={{
                width: active ? 26 : 8,
                height: 8,
                borderRadius: 8,
                background: done ? "#2e7d43" : active ? "#10251d" : "#d7ddd7",
                transition: "all .25s ease",
              }}
              aria-label={`Step ${i + 1}`}
            />
          );
        })}
      </div>

      {stage === "speed" && (
        <>
          <ul
            style={{
              display: "grid",
              gap: 12,
              textAlign: "left",
              margin: "0 auto",
              maxWidth: 420,
            }}
          >
            <Row ok={speedRunning ? null : downMbps !== null && downMbps > 0}>
              Internet download speed{" "}
              {speedRunning
                ? "— measuring…"
                : downMbps !== null && downMbps > 0
                  ? `— ${fmtMbps(downMbps)} Mbps`
                  : "— could not measure"}
            </Row>
            <Row ok={speedRunning ? null : upMbps !== null && upMbps > 0}>
              Internet upload speed{" "}
              {speedRunning
                ? "— measuring…"
                : upMbps !== null && upMbps > 0
                  ? `— ${fmtMbps(upMbps)} Mbps`
                  : "— could not measure"}
            </Row>
            <Row ok={speedRunning ? null : pingMs !== null}>
              Network response time{" "}
              {speedRunning
                ? "— measuring…"
                : pingMs !== null
                  ? `— ${pingMs} ms`
                  : ""}
            </Row>
          </ul>
          {!speedRunning && (
            <div className="assessment-actions" style={{ marginTop: 24 }}>
              <button
                className="button button-outline"
                onClick={() => void runSpeedCheck()}
              >
                Recheck speed
              </button>
              <button
                className="button button-blue"
                onClick={() => setStage("system")}
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {stage === "system" && (
        <>
          <ul
            style={{
              display: "grid",
              gap: 12,
              textAlign: "left",
              margin: "0 auto",
              maxWidth: 480,
            }}
          >
            <Row ok={true}>Internet speed test passed — your connection is responding</Row>
            <Row ok={platform === "other" ? false : null}>
              Technical check — one-time download, runs once, then expires
            </Row>
          </ul>

          <div
            style={{
              margin: "20px auto 0",
              maxWidth: 480,
              border: "1px solid #e2e6e1",
              borderRadius: 12,
              padding: "16px 18px",
              background: "#fbfbf8",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MonitorSmartphone size={16} />
              <strong style={{ fontSize: 14 }}>
                1. Download &amp; run the SwiftJob System Checker
              </strong>
            </div>
            <p
              style={{ fontSize: 12.5, color: "#66706a", margin: "6px 0 12px" }}
            >
              {platform === "windows"
                ? "Download the ZIP and extract its single EXE. Open the EXE to review a Continue/Cancel notice listing the system details collected. Continue starts the scan in the background and opens the normal Windows Installer. The report is sent to your application only after installation succeeds; canceling here or in the installer sends no report. The scan reads device type, manufacturer/model, Windows version/build/architecture, CPU, memory, graphics, storage, and any existing Windows system-rating data. It does not run a stress test or new benchmark, or collect serial numbers. Start the EXE within 30 minutes and finish the installer within 10 minutes."
                : platform === "macos"
                  ? "A one-time SwiftJob checker (.command). Run it after downloading — it reports basic device details once, then expires. It does not install Windows software."
                  : "This check must be completed on a supported computer."}
            </p>
            {platform === "macos" || platform === "windows" ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="button button-outline"
                  onClick={downloadTool}
                  disabled={issuing || toolRunState === "running" || toolVerified}
                >
                  {issuing ? (
                    <Loader2 size={15} className="spin" />
                  ) : (
                    <Download size={15} />
                  )}
                  {toolVerified
                    ? "Report received"
                    : toolRunState === "running"
                      ? "Check in progress"
                      : toolRunState === "expired"
                        ? "Download a fresh checker"
                        : downloaded
                          ? platform === "windows"
                            ? "Download ZIP again"
                            : "Download again"
                          : platform === "windows"
                            ? "Download checker ZIP"
                            : "Download the checker"}
                </button>
              </div>
            ) : (
              <p role="alert" style={{ color: "#8a4a25", fontSize: 13, margin: "10px 0 0" }}>
                The Windows checker is not available right now. Please contact{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for help.
              </p>
            )}
            {(platform === "macos" || platform === "windows") &&
              tokenExpiry &&
              !toolVerified && (
              <p style={{ fontSize: 11.5, color: "#8a948c", marginTop: 8 }}>
                {toolRunState === "running"
                  ? (() => {
                      const seconds = Math.max(0, Math.ceil((tokenExpiry.getTime() - statusClock) / 1000));
                      return `Installation window: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} remaining.`;
                    })()
                  : `Start the checker by ${tokenExpiry.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}.`}
              </p>
            )}
            {downloaded && !toolVerified && (
              <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: "#66706a", marginTop: 8 }}>
                {toolRunState === "running"
                  ? "The secure installation window is active. This page is checking automatically for a successful report."
                  : toolRunState === "expired"
                    ? "This checker has expired. Download a fresh one to retry."
                    : verifying
                      ? "Waiting for the downloaded checker to start. This page will update automatically."
                      : "Run the downloaded checker to continue. This page will update automatically."}
              </p>
            )}
          </div>

          {toolVerified && systemSpecEntries.length > 0 && (
            <div
              style={{
                margin: "14px auto 0",
                maxWidth: 640,
                textAlign: "left",
                background: "#f0f7f1",
                border: "1px solid #cfe3d3",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 13,
                color: "#274232",
              }}
            >
              <strong>System specifications reported</strong>
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                  gap: "10px 18px",
                  margin: "12px 0 0",
                }}
              >
                {systemSpecEntries.map(({ label, value }) => (
                  <div key={label}>
                    <dt style={{ fontSize: 11, fontWeight: 700, opacity: 0.76 }}>
                      {label}
                    </dt>
                    <dd style={{ margin: "2px 0 0", overflowWrap: "anywhere" }}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p style={{ margin: "12px 0 0", fontSize: 12, color: "#52675a" }}>
                {typingRequired
                  ? "Opening the required typing check automatically…"
                  : "Your report is complete. Opening the next application step automatically…"}
              </p>
            </div>
          )}

          {toolError && (
            <p style={{ color: "#c43b3b", fontSize: 13, marginTop: 12 }}>
              {toolError}
            </p>
          )}

          {!toolVerified && (
            <p style={{ color: "#8a4a25", fontSize: 13, marginTop: 10 }}>
              The page will continue automatically after the checker submits a successful report. This check is required.
            </p>
          )}
        </>
      )}

      {stage === "typing" && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 14,
              marginBottom: 14,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <span>
              <Keyboard size={14} /> Typing test
            </span>
            <span style={{ color: "#66706a" }}>
              {Math.max(0, Math.ceil(TYPING_SECONDS - elapsedSec))}s left
            </span>
            <span style={{ color: "#66706a" }}>
              {typedStartedAt
                ? `${Math.round(computeAccuracy(typed) / 5 / (Math.max(elapsedSec, 1) / 60))} WPM`
                : "Start typing to begin"}
            </span>
          </div>

          {!typingDone ? (
            <>
              <div
                style={{
                  border: "1px solid #e2e6e1",
                  borderRadius: 12,
                  padding: "14px 16px",
                  textAlign: "left",
                  background: "#fbfbf8",
                  maxHeight: 120,
                  overflow: "auto",
                  fontSize: 14,
                  lineHeight: 1.55,
                  marginBottom: 12,
                }}
              >
                {TYPING_PASSAGE.split("").map((ch, i) => {
                  const state =
                    i < typed.length
                      ? typed[i] === ch
                        ? "ok"
                        : "bad"
                      : i === typed.length
                        ? "cur"
                        : "todo";
                  return (
                    <span
                      key={i}
                      style={{
                        background:
                          state === "cur"
                            ? "#ffe9a8"
                            : state === "bad"
                              ? "#ffd9d9"
                              : "transparent",
                        textDecoration: state === "bad" ? "underline" : "none",
                        color: state === "todo" ? "#98a29a" : "#1f2a24",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </div>
              <textarea
                ref={areaRef}
                value={typed}
                onChange={(e) => onType(e.target.value)}
                rows={4}
                autoFocus
                spellCheck={false}
                placeholder="Start typing the passage above here…"
                style={{
                  width: "100%",
                  maxWidth: 560,
                  border: "1px solid #cfd6cf",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
              <p style={{ fontSize: 11.5, color: "#8a948c", marginTop: 8 }}>
                One attempt — it submits automatically when the timer ends.
              </p>
            </>
          ) : (
            <>
              <div
                style={{
                  display: "inline-flex",
                  gap: 18,
                  background: "#f0f7f1",
                  border: "1px solid #cfe3d3",
                  borderRadius: 12,
                  padding: "14px 22px",
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 800 }}>
                  {typingStats?.wpm} <small style={{ fontSize: 12 }}>WPM</small>
                </span>
                <span style={{ fontSize: 22, fontWeight: 800 }}>
                  {typingStats?.accuracyPct}
                  <small style={{ fontSize: 12 }}>% accuracy</small>
                </span>
              </div>
              <p
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  color: "#2e7d43",
                  marginTop: 12,
                }}
              >
                <ShieldCheck size={15} /> Recorded securely with your application
              </p>
              <p style={{ fontSize: 13, color: "#66706a", marginTop: 8 }}>
                Bringing up your role assessment…
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
