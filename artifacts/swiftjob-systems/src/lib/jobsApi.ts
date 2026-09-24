import { JOBS, type Job } from "@/data/jobs";
import { enrichBoilerplateRoleContent } from "@/lib/roleContent";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function presentJob(job: Job): Job {
  return { ...job, ...enrichBoilerplateRoleContent(job) };
}

export async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${API_BASE}/api/jobs`);
    if (!res.ok) throw new Error("Failed to load positions");
    const data = await res.json();
    return Array.isArray(data.jobs) ? data.jobs.map(presentJob) : JOBS.map(presentJob);
  } catch {
    // Keep the public careers experience usable if the API is temporarily unavailable.
    // The API/database remains the source of truth whenever it responds successfully.
    return JOBS.map(presentJob);
  }
}

export async function fetchJobBySlug(slug: string): Promise<Job | null> {
  try {
    const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(slug)}`);
    // A deliberate 404 means the role does not exist or has been deactivated —
    // never resurrect it from the static copy. Only infrastructure failures
    // (network errors, 5xx) fall back to the cached listings.
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to load position");
    const data = await res.json();
    return data.job ? presentJob(data.job) : null;
  } catch {
    const job = JOBS.find((item) => item.slug === slug);
    return job ? presentJob(job) : null;
  }
}
