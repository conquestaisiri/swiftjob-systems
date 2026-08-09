import { useState } from "react";
import { Link } from "wouter";
import {
  Mail,
  Loader2,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

export function CandidateLogin() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Please enter a valid email address.");
      setState("error");
      return;
    }

    setState("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
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
              Enter your email address and we&apos;ll send you a secure sign-in
              link.
            </p>
          </div>

          {state === "success" ? (
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
          ) : (
            <form onSubmit={handleSubmit} className="auth-form" noValidate>
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

              <button
                type="submit"
                className="button button-blue auth-submit"
                disabled={state === "submitting"}
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
                <a href="/#contact">Terms of Service</a> and{" "}
                <a href="/#contact">Privacy Policy</a>. We&apos;ll only use your
                email to send the sign-in link and application updates.
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
