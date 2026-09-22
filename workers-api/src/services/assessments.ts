import { neon } from "@neondatabase/serverless";
import { getEnv } from "../config";

export type AssessmentTrack =
  "office" | "technical" | "analytical" | "creative" | "none";

const FALLBACK_TRACK_TITLES: Record<Exclude<AssessmentTrack, "none">, string> = {
  office: "Role assessment",
  technical: "Technical assessment",
  analytical: "Analytical assessment",
  creative: "Communication assessment",
};

/** The candidate should always see the actual position they applied for. */
export function assessmentTitleForJob(
  jobTitle: string,
  track: AssessmentTrack,
): string | null {
  if (track === "none") return null;
  const title = jobTitle.trim();
  return title ? `${title} Assessment` : FALLBACK_TRACK_TITLES[track];
}

export function assessmentBlurbForJob(
  jobTitle: string,
  track: AssessmentTrack,
): string {
  if (track === "none") return "";
  const title = jobTitle.trim() || "this role";
  return `A short assessment for the ${title} role, matched to the skills and judgement this work requires.`;
}

/** Typing is part of the technical check only where the role calls for it. */
export function typingCheckRequiredForRole(input: {
  title: string;
  responsibilities?: string[] | null;
  requiredQualifications?: string[] | null;
  skills?: string[] | null;
}): boolean {
  const roleText = [
    input.title,
    ...(input.responsibilities ?? []),
    ...(input.requiredQualifications ?? []),
    ...(input.skills ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return /typing|wpm|transcrib|caption|subtit|data entry|keyboard|chat support|email support|call center|telemark|reception|proofread/.test(
    roleText,
  );
}

export function assessmentQuestionCount(track: AssessmentTrack): number {
  return track === "none" ? 0 : 4;
}

export function trackForDepartment(department: string): AssessmentTrack {
  const dept = (department || "").toLowerCase();
  if (dept.includes("on-site") || dept.includes("manual")) return "none";
  if (
    dept.includes("engineering") ||
    dept.includes("security") ||
    dept.includes("technical support") ||
    dept.includes("ai") ||
    dept.includes("it")
  ) {
    return "technical";
  }
  if (
    dept.includes("data") ||
    dept.includes("finance") ||
    dept.includes("senior") ||
    dept.includes("executive")
  ) {
    return "analytical";
  }
  if (
    dept.includes("creative") ||
    dept.includes("design") ||
    dept.includes("content") ||
    dept.includes("marketing")
  ) {
    return "creative";
  }
  return "office";
}

export interface AssessmentResult {
  id: string;
  applicationId: string;
  jobSlug: string;
  track: AssessmentTrack;
  status: string;
  score: number | null;
  maxScore: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentDetail extends AssessmentResult {
  systemCheck: Record<string, unknown>;
  responses: { mcq: Record<string, number>; scenario: string } | null;
}

const ROW_TO_RESULT = (row: Record<string, unknown>): AssessmentResult => ({
  id: String(row.id),
  applicationId: String(row.application_id),
  jobSlug: String(row.job_slug),
  track: row.track as AssessmentTrack,
  status: String(row.status),
  score: row.score === null ? null : Number(row.score),
  maxScore: row.max_score === null ? null : Number(row.max_score),
  completedAt: row.completed_at === null ? null : String(row.completed_at),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at ?? row.created_at),
});

const ROW_TO_DETAIL = (row: Record<string, unknown>): AssessmentDetail => {
  let responses: AssessmentDetail["responses"] = null;
  try {
    const raw = row.responses as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      responses = {
        mcq:
          (obj.mcq && typeof obj.mcq === "object"
            ? (obj.mcq as Record<string, number>)
            : {}) || {},
        scenario: typeof obj.scenario === "string" ? obj.scenario : "",
      };
    }
  } catch {
    responses = null;
  }
  let systemCheck: Record<string, unknown> = {};
  try {
    const raw = row.system_check as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      systemCheck = raw as Record<string, unknown>;
    }
  } catch {
    systemCheck = {};
  }
  return { ...ROW_TO_RESULT(row), responses, systemCheck };
};
interface AssessmentRepo {
  findForApplication(applicationId: string): Promise<AssessmentResult | null>;
  getDetailed(applicationId: string): Promise<AssessmentDetail | null>;
  listSummariesForApplications(
    applicationIds: string[],
  ): Promise<Map<string, AssessmentResult>>;
  save(
    applicationId: string,
    jobSlug: string,
    track: AssessmentTrack,
    systemCheck: unknown,
    responses: unknown,
    score: number | null,
    maxScore: number | null,
  ): Promise<AssessmentResult>;
  saveDraft(
    applicationId: string,
    jobSlug: string,
    track: AssessmentTrack,
    systemCheck: unknown,
    responses: unknown,
  ): Promise<AssessmentResult>;
}

export const assessmentRepository: AssessmentRepo = {
  async findForApplication(applicationId) {
    const { DATABASE_URL } = getEnv();
    if (!DATABASE_URL) throw new Error("DATABASE_URL must be set");
    const sql = neon(DATABASE_URL);
    const rows = await sql(
      `SELECT id, application_id, job_slug, track, status, score, max_score,
              completed_at, created_at, updated_at
       FROM assessments WHERE application_id = $1 LIMIT 1`,
      [applicationId],
    );
    if (!rows || rows.length === 0) return null;
    return ROW_TO_RESULT(rows[0]);
  },

  async getDetailed(applicationId) {
    const { DATABASE_URL } = getEnv();
    if (!DATABASE_URL) throw new Error("DATABASE_URL must be set");
    const sql = neon(DATABASE_URL);
    const rows = await sql(
      `SELECT id, application_id, job_slug, track, status, score, max_score,
              completed_at, created_at, updated_at, system_check, responses
       FROM assessments WHERE application_id = $1 LIMIT 1`,
      [applicationId],
    );
    if (!rows || rows.length === 0) return null;
    return ROW_TO_DETAIL(rows[0]);
  },

  async listSummariesForApplications(applicationIds) {
    const result = new Map<string, AssessmentResult>();
    if (applicationIds.length === 0) return result;
    const { DATABASE_URL } = getEnv();
    if (!DATABASE_URL) throw new Error("DATABASE_URL must be set");
    const sql = neon(DATABASE_URL);
    const rows = await sql(
      `SELECT id, application_id, job_slug, track, status, score, max_score,
              completed_at, created_at, updated_at
       FROM assessments WHERE application_id = ANY($1)`,
      [applicationIds],
    );
    for (const row of rows ?? []) {
      const item = ROW_TO_RESULT(row);
      result.set(item.applicationId, item);
    }
    return result;
  },

  async save(
    applicationId,
    jobSlug,
    track,
    systemCheck,
    responses,
    score,
    maxScore,
  ) {
    const { DATABASE_URL } = getEnv();
    if (!DATABASE_URL) throw new Error("DATABASE_URL must be set");
    const sql = neon(DATABASE_URL);
    // Single upsert on the unique application index — no find-then-insert
    // window, so a double submit can no longer collide into a 500.
    const rows = await sql(
      `INSERT INTO assessments (application_id, job_slug, track, status, system_check,
                                responses, score, max_score, completed_at)
       VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7, now())
       ON CONFLICT (application_id) DO UPDATE
         SET job_slug = EXCLUDED.job_slug,
             track = EXCLUDED.track,
             status = 'completed',
             system_check = EXCLUDED.system_check,
             responses = EXCLUDED.responses,
             score = EXCLUDED.score,
             max_score = EXCLUDED.max_score,
             completed_at = now(),
             updated_at = now()
       RETURNING id, application_id, job_slug, track, status, score, max_score,
                 completed_at, created_at, updated_at`,
      [
        applicationId,
        jobSlug,
        track,
        JSON.stringify(systemCheck),
        JSON.stringify(responses),
        score,
        maxScore,
      ],
    );
    return ROW_TO_RESULT(rows[0]);
  },

  async saveDraft(applicationId, jobSlug, track, systemCheck, responses) {
    const { DATABASE_URL } = getEnv();
    if (!DATABASE_URL) throw new Error("DATABASE_URL must be set");
    const sql = neon(DATABASE_URL);
    const rows = await sql(
      `INSERT INTO assessments (application_id, job_slug, track, status, system_check,
                                responses, score, max_score, completed_at)
       VALUES ($1, $2, $3, 'in_progress', $4, $5, NULL, NULL, NULL)
       ON CONFLICT (application_id) DO UPDATE
         SET job_slug = EXCLUDED.job_slug,
             track = EXCLUDED.track,
             system_check = CASE WHEN assessments.status = 'completed'
                                 THEN assessments.system_check ELSE EXCLUDED.system_check END,
             responses = CASE WHEN assessments.status = 'completed'
                              THEN assessments.responses ELSE EXCLUDED.responses END,
             updated_at = now()
       RETURNING id, application_id, job_slug, track, status, score, max_score,
                 completed_at, created_at, updated_at`,
      [
        applicationId,
        jobSlug,
        track,
        JSON.stringify(systemCheck ?? {}),
        JSON.stringify(responses ?? {}),
      ],
    );
    return ROW_TO_RESULT(rows[0]);
  },
};
