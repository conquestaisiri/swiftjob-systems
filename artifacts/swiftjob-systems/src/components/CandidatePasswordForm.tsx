import { useState, type FormEvent } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function CandidatePasswordForm({ token, onSessionChanged }: {
  token: string;
  onSessionChanged: (token: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save your password.");
      localStorage.setItem("candidate_token", data.token);
      onSessionChanged(data.token);
      setPassword("");
      setMessage("Password saved. Your other sessions have been signed out. Email-link sign-in remains available.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="card-block">
      <summary>Create a password for faster sign-in</summary>
      <p id="portal-password-help" className="card-block-desc">
        Your candidate account is ready. Add an optional password for faster sign-in, or keep using secure email links. This does not change your applications or assessment progress.
      </p>
      <form onSubmit={submit}>
        <label htmlFor="portal-password">New password</label>
        <div className="password-row">
          <input id="portal-password" type="password" autoComplete="new-password"
            required minLength={8} maxLength={200} value={password}
            aria-describedby={`portal-password-help${error ? " portal-password-error" : ""}`}
            aria-invalid={Boolean(error)} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
          <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
        </div>
        {error && <p id="portal-password-error" role="alert" className="form-error">{error}</p>}
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
