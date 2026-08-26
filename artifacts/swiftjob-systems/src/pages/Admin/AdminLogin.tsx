import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AlertCircle, Loader2 } from "lucide-react";
import { API_BASE, setAdminToken } from "@/lib/adminApi";
import { useTurnstile } from "@/lib/turnstile";

export function AdminLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (turnstile.enabled && !turnstile.token) {
      setError("Please complete the security check first.");
      return;
    }
    setLoading(true);

    try {
      const payload = JSON.stringify({
        email: cleanEmail,
        password,
        turnstileToken: turnstile.token || undefined,
      });

      console.log("[AdminLogin] Posting to:", `${API_BASE}/api/admin/login`);
      console.log("[AdminLogin] Body length:", payload.length);

      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned ${res.status}. Please try again.`);
      }

      if (!res.ok) {
        throw new Error(
          (data.error as string) || `Login failed (${res.status})`,
        );
      }

      setAdminToken(data.token as string);
      navigate("/admin", { replace: true });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
      console.error("[AdminLogin]", msg);
      turnstile.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="w-full max-w-md">
        <div className="admin-login-card">
          <div className="text-center mb-8">
            <div className="admin-login-brand">SwiftJob.adm</div>
            <h1 className="text-2xl font-bold text-slate-900">Admin login</h1>
            <p className="text-slate-500 mt-2">
              Sign in to manage applications, referrals and campaigns
            </p>
          </div>

          {error && (
            <div
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"
              role="alert"
            >
              <AlertCircle size={16} />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss"
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  color: "#c43b3b",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                \u00d7
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // Clear stale error when user starts typing
                  if (error) setError("");
                }}
                placeholder="your@email.com"
                autoComplete="username"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Your password"
                autoComplete="current-password"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            {turnstile.enabled && (
              <div className="turnstile-row">
                <div ref={turnstile.ref} className="turnstile-widget" />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            <Link href="/" className="text-blue-600 hover:underline">
              ← Back to site
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
