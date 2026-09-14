import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";

/**
 * NextStepFlow — the transparent "wait for your room" step shared by the
 * referral public page and the candidate portal.
 *
 * When opened it waits the configured delay, then reveals the candidate's
 * unique room link. It never silently loads a third-party background URL.
 *
 * The page UI is never blocked: everything runs in the background and the
 * overlay only surfaces once the wait is over.
 */

export interface NextStepConfig {
  backgroundUrl: string;
  roomLink: string;
  delaySeconds: number;
}

export interface NextStepCopy {
  waitTitle?: string;
  waitBody?: string;
  readyTitle?: string;
  readyBody?: string;
  openRoomLabel?: string;
  roomNote?: string;
}

interface NextStepFlowProps {
  open: boolean;
  onClose: () => void;
  config: NextStepConfig;
  copy?: NextStepCopy;
  /** Called when the room link is revealed (after the wait). */
  onRevealed?: () => void;
  /** Fetch the room link only when it is time to reveal it. When provided the
   *  config's roomLink is treated as a placeholder and never trusted up front. */
  fetchRoomLink?: () => Promise<string>;
}

export function NextStepFlow({
  open,
  onClose,
  config,
  copy,
  onRevealed,
  fetchRoomLink,
}: NextStepFlowProps) {
  const [phase, setPhase] = useState<"idle" | "waiting" | "ready" | "error">(
    "idle",
  );
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [roomLink, setRoomLink] = useState(config.roomLink || "");
  const [retrying, setRetrying] = useState(false);
  const revealedRef = useRef(false);
  const fetchedRef = useRef(false);

  const delay = Math.max(1, config.delaySeconds || 12);
  const hasRoom = Boolean(config.roomLink || fetchRoomLink);
  // Start/stop the flow with the open flag.
  useEffect(() => {
    if (!open) {
      setPhase("idle");
      setElapsed(0);
      setCopied(false);
      setRetrying(false);
      revealedRef.current = false;
      fetchedRef.current = false;
      return;
    }

    // Nothing to prepare — reveal the room immediately.
    if (!hasRoom) {
      setPhase("ready");
      return;
    }

    setPhase("waiting");
    setElapsed(0);
  }, [open, hasRoom]);

  // Countdown: waiting -> ready, fetching the room link at the end when it is
  // not shipped in the page payload (referral pages keep it off the wire).
  useEffect(() => {
    if (phase !== "waiting") return;
    const started = Date.now();
    let cancelled = false;
    const interval = window.setInterval(async () => {
      const passed = Math.floor((Date.now() - started) / 1000);
      setElapsed(passed);
      if (passed >= delay) {
        window.clearInterval(interval);
        if (fetchRoomLink && !fetchedRef.current) {
          fetchedRef.current = true;
          try {
            const link = await fetchRoomLink();
            if (!cancelled) {
              if (link) {
                setRoomLink(link);
                setPhase("ready");
              } else {
                // Never show a ready screen with an empty room link — surface
                // an error state with a retry instead.
                setPhase("error");
              }
            }
          } catch {
            if (!cancelled) setPhase("error");
          }
          return;
        }
        if (!cancelled) setPhase("ready");
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [phase, delay, fetchRoomLink]);

  // Manual retry after a failed reveal fetch — no full countdown again.
  const retryReveal = async () => {
    if (!fetchRoomLink || retrying) return;
    setRetrying(true);
    try {
      const link = await fetchRoomLink();
      if (link) {
        setRoomLink(link);
        setPhase("ready");
      }
    } catch {
      /* stay on the error screen; the admin note below applies */
    } finally {
      setRetrying(false);
    }
  };

  // Tell the caller once when the room is revealed.
  useEffect(() => {
    if (phase === "ready" && !revealedRef.current) {
      revealedRef.current = true;
      onRevealed?.();
    }
  }, [phase, onRevealed]);

  const resolvedRoomLink = roomLink || config.roomLink;

  if (!open || (phase === "idle" && !hasRoom)) {
    return null;
  }

  const percent =
    phase === "ready" ? 100 : Math.min(100, (elapsed / delay) * 100);

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(resolvedRoomLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your room link:", resolvedRoomLink);
    }
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-content shortlist-modal nextstep-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nextstep-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="nextstep-title">
              {phase === "ready"
                ? copy?.readyTitle || "Your room is ready"
                : phase === "error"
                  ? copy?.waitTitle || "Preparing your room"
                  : copy?.waitTitle || "Preparing your room"}
            </h2>
            <span className="modal-position">
              {phase === "ready"
                ? "Your next step is set up"
                : phase === "error"
                  ? "We couldn't finish preparing your room"
                  : "Your unique link is being prepared…"}
            </span>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {phase === "ready" && resolvedRoomLink ? (
            <div className="nextstep-ready">
              <div className="nextstep-ready-icon">
                <CheckCircle2 size={40} />
              </div>
              <p>
                {copy?.readyBody ||
                  "Your unique room link is below. Open it now to continue."}
              </p>

              <a
                href={resolvedRoomLink}
                target="_blank"
                rel="noreferrer"
                className="button button-blue nextstep-room-link"
              >
                <ExternalLink size={16} />
                {copy?.openRoomLabel || "Open my room"}
              </a>

              <div className="nextstep-room-copy-row">
                <input
                  readOnly
                  value={resolvedRoomLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className="filter-input admin-input nextstep-room-url"
                  aria-label="Room link"
                />
                <button
                  type="button"
                  onClick={copyRoom}
                  className="button button-sm button-outline"
                >
                  {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              {copy?.roomNote && (
                <p className="nextstep-note">{copy.roomNote}</p>
              )}
            </div>
          ) : phase === "error" ? (
            <div className="nextstep-wait">
              <div className="nextstep-spinner" style={{ color: "#c43b3b" }}>
                <AlertCircle size={34} />
              </div>
              <p>
                Something went wrong while preparing your room. Please try again
                — if it keeps failing, contact HR and they will set it up for
                you.
              </p>
              <button
                type="button"
                onClick={retryReveal}
                disabled={retrying}
                className="button button-blue"
              >
                {retrying ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ExternalLink size={15} />
                )}
                Try again
              </button>
              {copy?.roomNote && (
                <p className="nextstep-note">{copy.roomNote}</p>
              )}
            </div>
          ) : (
            <div className="nextstep-wait">
              <div className="nextstep-spinner">
                <Loader2 size={34} className="animate-spin" />
              </div>
              <p>
                {copy?.waitBody ||
                  "Give us a few seconds while this gets everything ready for you…"}
              </p>
              <div className="nextstep-progress-track">
                <div
                  className="nextstep-progress-bar"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="nextstep-seconds">
                {Math.max(0, delay - elapsed)}s remaining — please stay on this
                page
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-status-row">
            <button
              type="button"
              onClick={onClose}
              className="button button-sm button-outline"
            >
              {phase === "ready" ? "Close" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
