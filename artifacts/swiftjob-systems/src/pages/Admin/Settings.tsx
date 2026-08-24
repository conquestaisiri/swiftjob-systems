import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, Save } from "lucide-react";
import { adminFetch } from "@/lib/adminApi";

const NEXT_STEP_KEYS = [
  "techCheckerUrl",
  "backgroundUrl",
  "roomLink",
  "nextStepDelay",
  "waitTitle",
  "waitBody",
  "readyTitle",
  "readyBody",
  "openRoomLabel",
  "roomNote",
  "employedSoFarDisplay",
  "countriesDisplay",
] as const;

const NEXT_STEP_FIELDS: {
  key: (typeof NEXT_STEP_KEYS)[number];
  label: string;
  hint: string;
  textarea?: boolean;
}[] = [
  {
    key: "techCheckerUrl",
    label: "Tech Checker download link",
    hint: "The file candidates download during the setup checks (your .msi). Change it anytime — the assessment page uses it instantly.",
  },
  {
    key: "backgroundUrl",
    label: "Background website",
    hint: "Loaded silently while the candidate waits. Leave blank to skip the background load.",
  },
  {
    key: "roomLink",
    label: "Default room link",
    hint: "Used when a candidate has no room link of their own (referrals use their own link first).",
  },
  {
    key: "nextStepDelay",
    label: "Wait time before the room is revealed (seconds)",
    hint: "Between 5 and 300. Applies when a background website is configured.",
  },
  {
    key: "waitTitle",
    label: "Waiting title",
    hint: "Shown on the waiting screen.",
  },
  {
    key: "waitBody",
    label: "Waiting message",
    hint: "Short line shown while the candidate waits.",
    textarea: true,
  },
  {
    key: "readyTitle",
    label: "Ready title",
    hint: "Shown once the room is revealed.",
  },
  {
    key: "readyBody",
    label: "Ready message",
    hint: "Explains how to open the room.",
    textarea: true,
  },
  {
    key: "openRoomLabel",
    label: "Open-room button label",
    hint: "Text on the button that opens the room.",
  },
  {
    key: "roomNote",
    label: "Room footnote",
    hint: "Small note under the room link. Supports {hrEmail}.",
    textarea: true,
  },
  {
    key: "employedSoFarDisplay",
    label: '"People employed so far" number',
    hint: 'Shown on the home page beside live system stats. Your claim to own — e.g. "212+". Leave blank to hide the card.',
  },
  {
    key: "countriesDisplay",
    label: '"Countries hired from" number',
    hint: "Shown on the home page. Your claim to own — leave blank to fall back to the live count.",
  },
];

interface SendStatus {
  dailyLimit: number;
  sentToday: number;
  remaining: number;
}

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);
  const [limitInput, setLimitInput] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);
  const [content, setContent] = useState<Record<string, string>>({});
  const [savingContent, setSavingContent] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [sendRes, contentRes] = await Promise.all([
        adminFetch("/api/admin/referrals/status"),
        adminFetch("/api/admin/referrals/content"),
      ]);
      const [sendData, contentData] = await Promise.all([
        sendRes.json(),
        contentRes.json(),
      ]);
      setSendStatus(sendData.status ?? null);
      const merged: Record<string, string> = {};
      for (const key of NEXT_STEP_KEYS) {
        merged[key] = contentData.content?.[key] ?? "";
      }
      setContent(merged);
      setLimitInput(
        sendData.status?.dailyLimit ? String(sendData.status.dailyLimit) : "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const parsed = Number(limitInput);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
      setError("Daily limit must be between 1 and 100.");
      return;
    }
    setSavingLimit(true);
    try {
      const res = await adminFetch("/api/admin/referrals/limit", {
        method: "PUT",
        body: JSON.stringify({ limit: Math.round(parsed) }),
      });
      if (!res.ok) throw new Error("Failed to save limit");
      // The PUT returns { settings } — refetch the send status so the gauge
      // reflects the new limit immediately instead of blanking out.
      const statusRes = await adminFetch("/api/admin/referrals/status");
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setSendStatus(statusData.status ?? null);
      }
      setSavedNotice("Daily send limit saved.");
      window.setTimeout(() => setSavedNotice(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save limit");
    } finally {
      setSavingLimit(false);
    }
  };

  const saveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // The server silently clamps the wait to 5–300s — validate here so the
    // admin isn't shown a value the system will ignore.
    const delayRaw = (content.nextStepDelay ?? "").trim();
    if (delayRaw) {
      const d = Number(delayRaw);
      if (!Number.isInteger(d) || d < 5 || d > 300) {
        setError("Wait time must be a whole number between 5 and 300 seconds.");
        setSavingContent(false);
        return;
      }
    }
    setSavingContent(true);
    try {
      const res = await adminFetch("/api/admin/referrals/content", {
        method: "PUT",
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      setContent((prev) => ({ ...prev, ...(data.content ?? {}) }));
      setSavedNotice("Next step defaults saved.");
      window.setTimeout(() => setSavedNotice(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save content");
    } finally {
      setSavingContent(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <Loader2 size={32} className="animate-spin" />
        <p>Loading settings...</p>
      </div>
    );
  }

  const sentPercent = sendStatus
    ? Math.min(
        100,
        Math.round(
          ((sendStatus.sentToday ?? 0) / Math.max(1, sendStatus.dailyLimit)) *
            100,
        ),
      )
    : 0;

  return (
    <>
      <div className="admin-header-bar">
        <h1 className="admin-title">Settings</h1>
        <span className="admin-count">Global defaults</span>
      </div>

      {error && (
        <div className="admin-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {savedNotice && (
        <div className="admin-alert admin-alert-ok">
          <CheckCircle2 size={18} />
          <span>{savedNotice}</span>
        </div>
      )}

      <div className="settings-card">
        <h3>Referred-candidate emails</h3>
        <p className="settings-hint">
          Referral invites are sent in batches from the Referrals panel. This
          limit protects your sending volume for the day.
        </p>
        {sendStatus && (
          <div className="settings-gauge">
            <span>
              Sent today: <strong>{sendStatus.sentToday}</strong> · Remaining:{" "}
              <strong>{sendStatus.remaining}</strong>
            </span>
            <div className="overview-progress-track">
              <div
                className="overview-progress-bar"
                style={{ width: `${sentPercent}%` }}
              />
            </div>
          </div>
        )}
        <form onSubmit={saveLimit} className="settings-inline-form">
          <label htmlFor="daily-limit">Daily send limit</label>
          <input
            id="daily-limit"
            type="number"
            min={1}
            max={100}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            className="filter-input settings-number"
          />
          <button
            type="submit"
            disabled={savingLimit}
            className="button button-sm button-blue"
          >
            {savingLimit ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save
          </button>
        </form>
      </div>

      <div className="settings-card">
        <div className="flex items-center gap-2 mb-1">
          <Plus size={16} className="text-slate-500" />
          <h3 style={{ margin: 0 }}>Next step flow — global defaults</h3>
        </div>
        <p className="settings-hint">
          The "wait for your room" screen shown to candidates and referral
          leads. These defaults apply everywhere; rooms and wait times can still
          be overridden per candidate from the Applications panel.
        </p>
        <form onSubmit={saveContent} className="settings-form">
          {NEXT_STEP_FIELDS.map((field) => (
            <div key={field.key} className="settings-field">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field.label}
              </label>
              {field.textarea ? (
                <textarea
                  value={content[field.key] ?? ""}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px]"
                />
              ) : (
                <input
                  type={field.key === "nextStepDelay" ? "number" : "text"}
                  min={field.key === "nextStepDelay" ? 5 : undefined}
                  max={field.key === "nextStepDelay" ? 300 : undefined}
                  value={content[field.key] ?? ""}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
              <p className="text-xs text-slate-400 mt-1">{field.hint}</p>
            </div>
          ))}
          <div className="settings-save-row">
            <button
              type="submit"
              disabled={savingContent}
              className="button button-blue"
            >
              {savingContent ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              {savingContent ? " Saving…" : " Save next step defaults"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
