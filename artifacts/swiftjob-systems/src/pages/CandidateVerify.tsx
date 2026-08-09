import { useEffect, useState } from "react";
import { Link, useSearchParams } from "wouter";
import { Loader2, CheckCircle, AlertCircle, ArrowUpRight } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

export function CandidateVerify() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<"verifying" | "success" | "error">(
    "verifying",
  );
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Invalid or missing sign-in link. Please request a new one.");
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(
          `/api/auth/verify?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Invalid or expired sign-in link");
        }

        // Store the token in localStorage for subsequent API calls
        localStorage.setItem("candidate_token", data.token);
        setEmail(data.email);
        setState("success");
        setMessage("Welcome back! Redirecting to your applications...");

        // Redirect to applications page after a short delay
        setTimeout(() => {
          window.location.href = "/candidate/applications";
        }, 2000);
      } catch (err) {
        setState("error");
        setMessage(
          err instanceof Error
            ? err.message
            : "Sign-in failed. Please request a new link.",
        );
      }
    };

    verify();
  }, [token]);

  if (state === "verifying") {
    return (
      <SiteLayout title="Signing In — SwiftJob">
        <div className="auth-shell">
          <div className="auth-card reveal is-visible">
            <div className="auth-brand">
              <img
                src="/swiftjob-mark.svg"
                alt="SwiftJob"
                className="candidate-logo"
              />
            </div>
            <div className="auth-verifying">
              <Loader2 size={48} className="spin" />
              <h2>Verifying your sign-in link…</h2>
              <p>Please wait while we securely sign you in.</p>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (state === "success") {
    return (
      <SiteLayout title="Sign In Successful — SwiftJob">
        <div className="auth-shell">
          <div className="auth-card reveal is-visible">
            <div className="auth-brand">
              <img
                src="/swiftjob-mark.svg"
                alt="SwiftJob"
                className="candidate-logo"
              />
            </div>
            <div className="auth-success">
              <div className="success-icon">
                <CheckCircle size={48} strokeWidth={1.5} />
              </div>
              <h2>Welcome back, {email}</h2>
              <p>{message}</p>
              <Link
                href="/candidate/applications"
                className="button button-blue"
              >
                Go to my applications <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout title="Sign In Failed — SwiftJob">
      <div className="auth-shell">
        <div className="auth-card reveal is-visible">
          <div className="auth-brand">
            <img
              src="/swiftjob-mark.svg"
              alt="SwiftJob"
              className="candidate-logo"
            />
          </div>
          <div className="auth-error-state">
            <div className="error-icon">
              <AlertCircle size={48} strokeWidth={1.5} />
            </div>
            <h2>Unable to sign in</h2>
            <p>{message}</p>
            <div className="error-actions">
              <Link href="/login" className="button button-blue">
                Request a new link <ArrowUpRight size={16} />
              </Link>
              <Link href="/careers" className="button button-outline">
                Back to careers
              </Link>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
