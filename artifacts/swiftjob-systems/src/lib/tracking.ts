// Ads conversion tracking. Both Meta Pixel and Google Analytics 4 are
// optional: they only load when VITE_META_PIXEL_ID / VITE_GA4_ID are set at
// build time. Without them every call is a silent no-op.

type TrackEvent =
  | "page_view"
  | "view_content"
  | "lead"
  | "cta_click"
  | "apply_submit"
  | "referral_start";

const META_PIXEL_ID =
  (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() || "";
const GA4_ID =
  (import.meta.env.VITE_GA4_ID as string | undefined)?.trim() || "";

let initialized = false;

function loadScript(src: string): void {
  const existing = document.querySelector(`script[data-track-src="${src}"]`);
  if (existing) return;
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.dataset.trackSrc = src;
  document.head.appendChild(script);
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function initTracking(): void {
  if (initialized) return;
  initialized = true;

  if (META_PIXEL_ID) {
    window._fbq ??= [];
    loadScript("https://connect.facebook.net/en_US/fbevents.js");
    if (typeof window.fbq === "function") {
      window.fbq("init", META_PIXEL_ID);
    } else {
      (window._fbq as unknown[]).push(["init", META_PIXEL_ID]);
    }
  }

  if (GA4_ID) {
    window.dataLayer ??= [];
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`);
    window.dataLayer.push("js", new Date());
    window.dataLayer.push("config", GA4_ID);
  }
}

const META_EVENT_NAMES: Record<TrackEvent, string> = {
  page_view: "PageView",
  view_content: "ViewContent",
  lead: "Lead",
  cta_click: "CustomizeEvent_cta_click",
  apply_submit: "CompleteRegistration",
  referral_start: "CustomizeEvent_referral_start",
};

export function trackEvent(
  event: TrackEvent,
  params?: Record<string, unknown>,
): void {
  initTracking();
  if (!META_PIXEL_ID && !GA4_ID) return;

  try {
    if (typeof window.fbq === "function") {
      window.fbq("track", META_EVENT_NAMES[event], params ?? {});
    } else if (Array.isArray(window._fbq)) {
      (window._fbq as unknown[]).push([
        "track",
        META_EVENT_NAMES[event],
        params ?? {},
      ]);
    }
    window.gtag?.("event", event, params ?? {});
  } catch {
    // Never let tracking break the site.
  }
}
