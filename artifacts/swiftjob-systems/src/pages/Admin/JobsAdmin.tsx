import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  X,
  Briefcase,
} from "lucide-react";
import type { Job } from "@/data/jobs";
import { parseDateOnly } from "@/lib/utils";
import { handleAdminUnauthorized, isUnauthorized } from "@/lib/adminAuth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface AdminJob extends Job {
  id: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract"];
const WORK_ARRANGEMENTS = ["Remote", "Hybrid", "On-site"];
const EXPERIENCE_LEVELS = ["Entry-Level", "Mid-Level", "Senior"];

const LIST_FIELDS = [
  "responsibilities",
  "requiredQualifications",
  "preferredQualifications",
  "skills",
  "softwareTools",
  "benefits",
  "hiringProcess",
] as const;

type FormState = Record<string, string>;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toForm(job: Job): FormState {
  const form: FormState = {};
  for (const key of Object.keys(job) as (keyof Job)[]) {
    const value = job[key];
    if (Array.isArray(value)) {
      form[key] = value.join("\n");
    } else {
      form[key] = String(value ?? "");
    }
  }
  return form;
}

const EMPTY_FORM: FormState = {
  slug: "",
  title: "",
  department: "",
  employmentType: "Full-time",
  workArrangement: "Remote",
  experienceLevel: "Entry-Level",
  experience: "",
  compensation: "",
  postedDate: "",
  summary: "",
  overview: "",
  responsibilities: "",
  requiredQualifications: "",
  preferredQualifications: "",
  skills: "",
  softwareTools: "",
  benefits: "",
  workingHours: "",
  hiringProcess: "",
  isActive: "true",
};

function JobEditor({
  job,
  departments,
  onSave,
  onClose,
}: {
  job: AdminJob | null;
  departments: string[];
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    job ? toForm(job) : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slugTouched, setSlugTouched] = useState(Boolean(job));

  const set =
    (field: string) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const value = e.target.value;
      setForm((f) => {
        const next = { ...f, [field]: value };
        if (field === "title" && !slugTouched) {
          next.slug = slugify(value);
        }
        return next;
      });
    };

  const toggleActive = () =>
    setForm((f) => ({
      ...f,
      isActive: f.isActive === "true" ? "false" : "true",
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const key of Object.keys(form)) {
        if ((LIST_FIELDS as readonly string[]).includes(key)) {
          payload[key] = form[key]
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean);
        } else {
          payload[key] = form[key].trim();
        }
      }
      payload.isActive = form.isActive === "true";
      await onSave(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save job");
      setSaving(false);
    }
  };

  const textarea = (field: string, rows = 4, placeholder = "") => (
    <div className="job-editor-field job-editor-field-full">
      <label>
        {field.replace(/([A-Z])/g, " $1").trim()}{" "}
        <span className="opt">(one per line)</span>
      </label>
      <textarea
        value={form[field] ?? ""}
        onChange={set(field)}
        rows={rows}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content job-editor-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{job ? "Edit job" : "Add a job"}</h2>
            <span className="modal-position">
              {job ? job.slug : "New position"}
            </span>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="admin-alert" style={{ marginBottom: 18 }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="job-editor-grid">
              <div className="job-editor-field">
                <label>
                  Title <span className="req">*</span>
                </label>
                <input
                  value={form.title ?? ""}
                  onChange={set("title")}
                  required
                />
              </div>
              <div className="job-editor-field">
                <label>
                  Slug <span className="req">*</span>
                </label>
                <input
                  value={form.slug ?? ""}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug")(e);
                  }}
                  required
                />
              </div>
              <div className="job-editor-field">
                <label>
                  Department <span className="req">*</span>
                </label>
                <input
                  list="job-departments"
                  value={form.department ?? ""}
                  onChange={set("department")}
                  required
                />
                <datalist id="job-departments">
                  {departments.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>
              <div className="job-editor-field">
                <label>
                  Employment type <span className="req">*</span>
                </label>
                <select
                  value={form.employmentType ?? ""}
                  onChange={set("employmentType")}
                  required
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="job-editor-field">
                <label>
                  Work arrangement <span className="req">*</span>
                </label>
                <select
                  value={form.workArrangement ?? ""}
                  onChange={set("workArrangement")}
                  required
                >
                  {WORK_ARRANGEMENTS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <div className="job-editor-field">
                <label>
                  Experience level <span className="req">*</span>
                </label>
                <select
                  value={form.experienceLevel ?? ""}
                  onChange={set("experienceLevel")}
                  required
                >
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="job-editor-field">
                <label>
                  Experience <span className="req">*</span>
                </label>
                <input
                  value={form.experience ?? ""}
                  onChange={set("experience")}
                  placeholder="e.g. 1–2 years"
                  required
                />
              </div>
              <div className="job-editor-field">
                <label>
                  Compensation <span className="req">*</span>
                </label>
                <input
                  value={form.compensation ?? ""}
                  onChange={set("compensation")}
                  placeholder="e.g. $700–$1,000/month"
                  required
                />
              </div>
              <div className="job-editor-field">
                <label>
                  Posted date <span className="req">*</span>
                </label>
                <input
                  type="date"
                  value={form.postedDate ?? ""}
                  onChange={set("postedDate")}
                  required
                />
              </div>
              <div className="job-editor-field job-editor-toggle">
                <label>Status</label>
                <button
                  type="button"
                  className={`admin-active-toggle ${form.isActive === "false" ? "is-off" : ""}`}
                  onClick={toggleActive}
                >
                  {form.isActive === "false" ? (
                    <EyeOff size={14} />
                  ) : (
                    <Eye size={14} />
                  )}
                  {form.isActive === "false" ? " Hidden" : " Live"}
                </button>
              </div>
            </div>

            <div className="job-editor-field job-editor-field-full">
              <label>
                Summary <span className="req">*</span>
              </label>
              <textarea
                value={form.summary ?? ""}
                onChange={set("summary")}
                rows={2}
                required
              />
            </div>
            <div className="job-editor-field job-editor-field-full">
              <label>
                Overview <span className="req">*</span>
              </label>
              <textarea
                value={form.overview ?? ""}
                onChange={set("overview")}
                rows={5}
                required
              />
            </div>
            <div className="job-editor-field job-editor-field-full">
              <label>
                Working hours <span className="req">*</span>
              </label>
              <textarea
                value={form.workingHours ?? ""}
                onChange={set("workingHours")}
                rows={2}
                required
              />
            </div>

            {textarea("responsibilities", 6)}
            {textarea("requiredQualifications", 6)}
            {textarea("preferredQualifications", 4)}
            {textarea("skills", 4)}
            {textarea("softwareTools", 4)}
            {textarea("benefits", 4)}
            {textarea("hiringProcess", 5)}
          </div>

          <div className="modal-footer">
            <span className="modal-applied">
              {job
                ? `Last updated ${new Date(job.updatedAt).toLocaleDateString()}`
                : "New position"}
            </span>
            <div className="modal-status-row">
              <button
                type="button"
                onClick={onClose}
                className="button button-sm button-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="button button-blue"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Briefcase size={16} />
                )}
                {saving ? " Saving…" : job ? " Save changes" : " Create job"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function JobsAdmin({ token }: { token: string }) {
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState<null | "new" | AdminJob>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const departments = useMemo(
    () => [...new Set(jobs.map((j) => j.department))].sort(),
    [jobs],
  );

  const loadJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (isUnauthorized(res)) {
        handleAdminUnauthorized();
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      setJobs(data.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const saveJob = async (payload: Record<string, unknown>) => {
    const isNew = editorOpen === "new";
    const res = await fetch(
      `${API_BASE}/api/admin/jobs${isNew ? "" : `/${(editorOpen as AdminJob).id}`}`,
      {
        method: isNew ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save job");
    await loadJobs();
    setEditorOpen(null);
  };

  const deleteJob = async (job: AdminJob) => {
    if (
      !window.confirm(
        `Delete the "${job.title}" position? This cannot be undone.`,
      )
    )
      return;
    setBusy(job.id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/jobs/${job.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete job");
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete job");
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (job: AdminJob) => {
    setBusy(job.id);
    try {
      const payload: Record<string, unknown> = toForm(job);
      for (const key of Object.keys(payload)) {
        if ((LIST_FIELDS as readonly string[]).includes(key)) {
          payload[key] = String(payload[key])
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean);
        }
      }
      payload.isActive = !job.isActive;
      const res = await fetch(`${API_BASE}/api/admin/jobs/${job.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update job");
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, ...data.job } : j)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update job");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="admin-header-bar">
        <h1 className="admin-title">Jobs</h1>
        <div className="admin-header-actions-inline">
          <span className="admin-count">{jobs.length} total</span>
          <button
            className="button button-blue"
            onClick={() => setEditorOpen("new")}
          >
            <Plus size={16} /> Add job
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="admin-loading">
          <Loader2 size={32} className="animate-spin" />
          <p>Loading jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="admin-empty">
          <Briefcase size={48} />
          <h3>No jobs yet</h3>
          <p>Add your first position to publish it on the careers page.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Department</th>
                <th>Compensation</th>
                <th>Posted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <div className="position-info">
                      <div className="position-title">{job.title}</div>
                      <div className="position-experience">/{job.slug}</div>
                    </div>
                  </td>
                  <td>
                    <div className="position-experience">{job.department}</div>
                  </td>
                  <td>
                    <div className="position-experience">
                      {job.compensation}
                    </div>
                  </td>
                  <td className="date-cell">
                    {parseDateOnly(job.postedDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${job.isActive ? "status-live" : "status-hidden"}`}
                    >
                      {job.isActive ? "Live" : "Hidden"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => toggleActive(job)}
                        disabled={busy === job.id}
                        className="action-btn"
                        title={
                          job.isActive
                            ? "Hide from careers page"
                            : "Publish to careers page"
                        }
                      >
                        {job.isActive ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => setEditorOpen(job)}
                        className="action-btn"
                        title="Edit job"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => deleteJob(job)}
                        className="action-btn action-btn-danger"
                        title="Delete job"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen && (
        <JobEditor
          job={editorOpen === "new" ? null : editorOpen}
          departments={departments}
          onSave={saveJob}
          onClose={() => setEditorOpen(null)}
        />
      )}
    </>
  );
}
