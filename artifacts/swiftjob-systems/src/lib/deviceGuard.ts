import { useState, useCallback, useEffect } from "react";

// ============================================================================
// Device guard — decides, with high confidence and against every common spoof
// trick (request-desktop-site UA/width, extensions, VPNs, emulation), whether
// the visitor is really on a PC/laptop.
//
// Strategy: you cannot fake the PHYSICS of a phone.
//   - A real phone/tablet has a coarse primary pointer, no hover capability,
//     and a multi-touch screen — "desktop site" mode changes NONE of these.
//   - Chrome's userAgentData (where present) reports real hardware and is not
//     spoofed by desktop mode; navigator.platform also stays truthful.
//   - Any real finger tap fires a touchstart/pointerdown with pointerType
//     'touch' — a mouse cannot fake that, and we re-verify on every event.
// ============================================================================

export type DeviceVerdict = "desktop" | "mobile";
export type GuardStatus = "checking" | "desktop" | "mobile";
export type DeviceSignals = Record<string, string | number | boolean>;

let touchSeen = false;
let mouseSeen = false;
let listenersInstalled = false;

const MOBILE_UA_RE =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|windows phone|Windows Phone|xbox|mobi|Mobile/i;
const MOBILE_PLATFORM_RE = /iPhone|iPad|iPod|Android|Mobile|Symbian/i;
const ARM_LINUX_RE = /Linux (aarch64|armv8l|armv7l|armv6l|arm)/i;

/** Install once, process-wide: watch real input events. */
export function installRuntimeListeners(): void {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;

  const onTouch = () => {
    touchSeen = true;
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") touchSeen = true;
    else if (e.pointerType === "mouse") mouseSeen = true;
  };
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") mouseSeen = true;
  };

  window.addEventListener("touchstart", onTouch, true);
  document.addEventListener("touchstart", onTouch, true);
  window.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointermove", onPointerMove, true);
}

/**
 * Full analysis of the current device. Returns a verdict, the individual
 * signals (for audit/logging), the weighted score, and the "hard" reasons that
 * by themselves prove a mobile device.
 */
export function analyzeDevice(): {
  verdict: DeviceVerdict;
  signals: DeviceSignals;
  score: number;
  hardReasons: string[];
} {
  const signals: DeviceSignals = {};
  const hardReasons: string[] = [];
  let score = 0;

  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return { verdict: "desktop", signals, score: 0, hardReasons };
  }

  const ua = navigator.userAgent || "";
  const nav: Navigator & {
    userAgentData?: { mobile?: boolean; platform?: string };
    vibrate?: unknown;
    standalone?: unknown;
    maxTouchPoints?: number;
  } = navigator as never;

  // --- Runtime proof: an actual finger tap anywhere on the page -------------
  signals.touchSeen = touchSeen;
  signals.mouseSeen = mouseSeen;
  if (touchSeen) {
    hardReasons.push("real-touch-seen");
    score += 100;
  }
  if (mouseSeen) score -= 3;

  // --- Unspoofable platform truth -------------------------------------------
  const uaData = nav.userAgentData;
  signals.uaDataSupported = !!uaData;
  if (uaData?.mobile === true) {
    hardReasons.push("userAgentData.mobile");
    score += 100;
  }
  const uaPlatform = uaData?.platform ?? "";
  signals.uaPlatform = uaPlatform;
  if (/Android/i.test(uaPlatform)) {
    hardReasons.push("userAgentData.platform=Android");
    score += 100;
  }

  const platform = nav.platform || "";
  signals.platform = platform;
  if (MOBILE_PLATFORM_RE.test(platform)) {
    hardReasons.push("navigator.platform");
    score += 100;
  } else if (ARM_LINUX_RE.test(platform)) {
    // ARM Linux is almost always an Android-derived device in desktop mode.
    score += 4;
  }

  signals.uaMobile = MOBILE_UA_RE.test(ua);
  if (signals.uaMobile) score += 2;

  signals.iOSStandalone = nav.standalone !== undefined;
  if (nav.standalone !== undefined) score += 3;

  signals.vibrateSupport = typeof nav.vibrate === "function";
  if (typeof nav.vibrate === "function") score += 3;

  // --- Physical pointer capabilities (immune to desktop-site mode) ----------
  const q = (m: string) =>
    typeof window.matchMedia === "function" ? window.matchMedia(m) : null;

  const coarse = q("(pointer: coarse)")?.matches ?? false;
  signals.coarsePointer = coarse;
  if (coarse) {
    hardReasons.push("pointer:coarse");
    score += 100;
  }

  const noHover = q("(hover: none)")?.matches ?? false;
  signals.noHover = noHover;
  if (noHover) {
    hardReasons.push("hover:none");
    score += 100;
  }

  const finePointer = q("(pointer: fine)")?.matches ?? false;
  signals.finePointer = finePointer;
  if (finePointer) score -= 2;

  const hoverHover = q("(hover: hover)")?.matches ?? false;
  signals.hoverHover = hoverHover;
  if (hoverHover) score -= 1;

  const maxTouch =
    typeof nav.maxTouchPoints === "number" ? nav.maxTouchPoints : 0;
  signals.maxTouchPoints = maxTouch;
  if (maxTouch >= 5) score += 3;
  else if (maxTouch > 0) score += 1;

  let ontouch = false;
  if (typeof document !== "undefined") {
    ontouch =
      "ontouchstart" in window || "ontouchstart" in document.documentElement;
  }
  signals.ontouchstart = ontouch;
  if (ontouch) score += 1;

  // --- Screen physics ---------------------------------------------------------
  const dpr =
    typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : 1;
  signals.dpr = dpr;
  if (dpr >= 3) score += 3;
  else if (dpr >= 2.5) score += 2;
  else if (dpr >= 2) score += 1;

  const screenWidth =
    typeof window.screen?.width === "number" ? window.screen.width : 0;
  signals.screenWidth = screenWidth;
  const innerWidth = window.innerWidth || 0;
  signals.innerWidth = innerWidth;

  // The "request desktop site" signature: the layout viewport becomes wider
  // than the physical screen, which only ever happens in mobile desktop mode.
  if (screenWidth > 0 && innerWidth > screenWidth && screenWidth < 900) {
    signals.desktopModeSignature = true;
    score += 5;
  }

  const physicalWidth = screenWidth * dpr;
  signals.physicalWidth = physicalWidth;
  if (physicalWidth > 0 && physicalWidth < 1300) score += 1;

  const verdict: DeviceVerdict =
    hardReasons.length > 0 || score >= 7 ? "mobile" : "desktop";
  return { verdict, signals, score, hardReasons };
}

/** Compact flat payload for the backend footprint (sanitized server-side). */
export function deviceMeta(): Record<string, unknown> {
  const r = analyzeDevice();
  return {
    verdict: r.verdict,
    score: r.score,
    hard: r.hardReasons.join(","),
    touchSeen: r.signals.touchSeen,
    coarsePointer: r.signals.coarsePointer,
    noHover: r.signals.noHover,
    dpr: r.signals.dpr,
    platform: r.signals.platform,
    uaPlatform: r.signals.uaPlatform,
    maxTouchPoints: r.signals.maxTouchPoints,
    desktopModeSignature: r.signals.desktopModeSignature,
  };
}

/**
 * React hook: keeps a live verdict, re-verifying on every pointer/touch event,
 * focus, and on a short interval so any spoof trick gets caught the moment it
 * happens. The gate UI must not enable the continue link until status is
 * "desktop".
 */
export function useDeviceGuard(): {
  status: GuardStatus;
  signals: DeviceSignals | null;
  recheck: () => void;
} {
  const [status, setStatus] = useState<GuardStatus>("checking");
  const [signals, setSignals] = useState<DeviceSignals | null>(null);

  const recheck = useCallback(() => {
    const r = analyzeDevice();
    setSignals(r.signals);
    setStatus(r.verdict === "mobile" ? "mobile" : "desktop");
  }, []);

  useEffect(() => {
    installRuntimeListeners();
    recheck();
    const t1 = window.setTimeout(recheck, 80);
    const t2 = window.setTimeout(recheck, 400);
    const t3 = window.setTimeout(recheck, 1200);
    const onPointer = () => recheck();
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("touchstart", onPointer, true);
    window.addEventListener("pointermove", onPointer, true);
    window.addEventListener("focus", recheck);
    const iv = window.setInterval(recheck, 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearInterval(iv);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("touchstart", onPointer, true);
      window.removeEventListener("pointermove", onPointer, true);
      window.removeEventListener("focus", recheck);
    };
  }, [recheck]);

  return { status, signals, recheck };
}
