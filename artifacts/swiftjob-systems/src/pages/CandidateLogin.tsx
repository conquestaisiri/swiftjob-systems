import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Mail,
  Loader2,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useTurnstile } from "@/lib/turnstile";

type Mode = "magic" | "password";

export function CandidateLogin() {
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const turnstile = useTurnstile();
  const [, setLocation] = useLocation();

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Please enter a valid email address.");
      setState("error");
      return;
    }
    if (turnstile.enabled && !turnstile.token) {
      setMessage("Please complete the security check first.");
      setState("error");
      return;
    }

    setState("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          turnstileToken: turnstile.token,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send magic link");

      setState("success");
      setMessage(data.message || "Check your email for a magic link.");
    } catch (err) {
      setState("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      turnstile.reset();
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setMessage("Enter your email and password.");
      setState("error");
      return;
    }
    setState("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-in failed");
      localStorage.setItem("candidate_token", data.token);
      setLocation("/candidate/applications");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <SiteLayout title="Sign In — SwiftJob">
      <div className="auth-shell">
        <div className="auth-card reveal is-visible">
          <div className="auth-header">
            <Link
              href="/"
              className="auth-back"
              onClick={(e) => {
                e.preventDefault();
                window.history.back();
              }}
            >
              <ArrowLeft size={18} /> Back
            </Link>
            <div className="auth-brand">
              <img
                src="/swiftjob-mark.svg"
                alt="SwiftJob"
                className="candidate-logo"
              />
            </div>
            <h1>Sign in to your candidate portal</h1>
            <p>
              {mode === "magic"
                ? "We'll email you a secure sign-in link — no password needed."
                : "Use the password you created after applying."}
            </p>
          </div>

          {/* Mode switch */}
          <div className="auth-mode-row" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "magic"}
              className={`auth-mode-btn${mode === "magic" ? " active" : ""}`}
              onClick={() => {
                setMode("magic");
                setState("idle");
                setMessage("");
              }}
            >
              <Mail size={14} /> Email link
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "password"}
              className={`auth-mode-btn${mode === "password" ? " active" : ""}`}
              onClick={() => {
                setMode("password");
                setState("idle");
                setMessage("");
              }}
            >
              <KeyRound size={14} /> Password
            </button>
          </div>

          {state === "success" && mode === "magic" ? (
            <div className="auth-success">
              <div className="success-icon">
                <CheckCircle size={48} strokeWidth={1.5} />
              </div>
              <h2>Check your inbox</h2>
              <p>{message}</p>
              <p className="auth-hint">
                The link expires in 15 minutes. If you don&apos;t see it, check
                your spam folder.
              </p>
            </div>
          ) : mode === "magic" ? (
            <form onSubmit={handleMagic} className="auth-form" noValidate>
              {state === "error" && (
                <div className="auth-error" role="alert">
                  <AlertCircle size={18} />
                  <span>{message}</span>
                </div>
              )}

              <div className="form-field">
                <label htmlFor="email">Email address</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    disabled={state === "submitting"}
                    className={state === "error" ? "has-error" : ""}
                  />
                </div>
              </div>

              {turnstile.enabled && (
                <div className="turnstile-row">
                  <div ref={turnstile.ref} className="turnstile-widget" />
                </div>
              )}

              <button
                type="submit"
                className="button button-blue auth-submit"
                disabled={
                  state === "submitting" ||
                  (turnstile.enabled && !turnstile.token)
                }
              >
                {state === "submitting" ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send magic link <ArrowUpRight size={16} />
                  </>
                )}
              </button>

              <p className="auth-note">
                By continuing, you agree to our{" "}
                <Link href="/terms">Terms of Service</Link> and{" "}
                <Link href="/privacy">Privacy Policy</Link>. We&apos;ll only use
                your email to send the sign-in link and application updates.
              </p>
            </form>
          ) : (
            <form onSubmit={handlePassword} className="auth-form" noValidate>
              {state === "error" && (
                <div className="auth-error" role="alert">
                  <AlertCircle size={18} />
                  <span>{message}</span>
                </div>
              )}

              <div className="form-field">
                <label htmlFor="email-pw">Email address</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="email-pw"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    disabled={state === "submitting"}
                    className={state === "error" ? "has-error" : ""}
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <KeyRound size={18} className="input-icon" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your portal password"
                    autoComplete="current-password"
                    required
                    disabled={state === "submitting"}
                    className={state === "error" ? "has-error" : ""}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="button button-blue auth-submit"
                disabled={state === "submitting"}
              >
                {state === "submitting" ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowUpRight size={16} />
                  </>
                )}
              </button>

              <p className="auth-note">
                Forgot your password? Switch to{" "}
                <button
                  type="button"
                  className="auth-linklike"
                  onClick={() => setMode("magic")}
                >
                  Email link
                </button>{" "}
                — signing in by email works as your reset, and you can set a new
                password afterwards.
              </p>
            </form>
          )}

          <div className="auth-footer">
            <Link href="/careers" className="text-link">
              <ArrowLeft size={14} /> Back to careers
            </Link>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
