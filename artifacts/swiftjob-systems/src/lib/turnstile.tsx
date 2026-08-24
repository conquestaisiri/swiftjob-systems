import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile integration.
 *
 * The API verifies turnstile tokens on the magic-link and admin-login
 * endpoints whenever TURNSTILE_SECRET_KEY is set. This module renders the
 * widget client-side when a site key is configured (VITE_TURNSTILE_SITE_KEY)
 * and exposes the resulting token for the request body. When no site key is
 * set, the widget is skipped and `enabled` is false — matching the API's
 * fail-open behaviour when no secret is configured.
 */

export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || "";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    if (typeof window === "undefined" || window.turnstile) {
      resolve();
      return;
    }
    const previous = window.onTurnstileLoad;
    window.onTurnstileLoad = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) resolve();
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileState {
  /** Whether a site key is configured (widget rendered). */
  enabled: boolean;
  /** The verification token, or null while not solved. */
  token: string | null;
  /** Attach to a div where the widget should render. */
  ref: React.RefObject<HTMLDivElement | null>;
  /** Reset the widget (e.g. after a failed submit). */
  reset: () => void;
}

export function useTurnstile(): TurnstileState {
  const [token, setToken] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let disposed = false;

    loadTurnstileScript().then(() => {
      if (disposed || !ref.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
        size: "normal",
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(null),
        "error-callback": () => setToken(null),
      });
    });

    return () => {
      disposed = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* best-effort cleanup */
        }
      }
      widgetId.current = null;
    };
  }, []);

  const reset = () => {
    setToken(null);
    if (window.turnstile && widgetId.current) {
      try {
        window.turnstile.reset(widgetId.current);
      } catch {
        /* best-effort reset */
      }
    }
  };

  return { enabled: Boolean(TURNSTILE_SITE_KEY), token, ref, reset };
}
