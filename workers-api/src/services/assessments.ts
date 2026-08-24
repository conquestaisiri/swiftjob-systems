import { neon } from "@neondatabase/serverless";
import { getEnv } from "../config";

// Idempotent assessment schema (mirrors migrations/009_assessments.sql).
// Runs once per Worker isolate as a safety net, same pattern as campaigns.
const ASSESSMENT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  job_slug text NOT NULL,
  track text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  system_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  score int,
  max_score int,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_application ON assessments (application_id);
CREATE INDEX IF NOT EXISTS idx_assessments_job_slug ON assessments (job_slug);
-- Data repair: the actuary compensation was seeded with a corrupted dash
-- character. Match any "$3,000…" variant that is not already correct so the
-- repair actually fires regardless of how the dash was mangled.
UPDATE jobs SET compensation = '$3,000–$6,500/month'
WHERE slug = 'actuary' AND compensation LIKE '$3,000%' AND compensation <> '$3,000–$6,500/month';
`;

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

async function runAssessmentSchema(): Promise<void> {
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }
  const sql = neon(DATABASE_URL);
  for (const statement of ASSESSMENT_SCHEMA_SQL.split(";")) {
    const trimmed = statement.trim();
    if (trimmed) {
      await sql(trimmed);
    }
  }
}

export function ensureAssessmentSchemaOnce(): Promise<void> {
  if (schemaEnsured) return Promise.resolve();
  if (!schemaPromise) {
    schemaPromise = runAssessmentSchema().then(() => {
      schemaEnsured = true;
    });
  }
  return schemaPromise;
}

export type AssessmentTrack =
  "office" | "technical" | "analytical" | "creative" | "none";

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
}

export const assessmentRepository: AssessmentRepo = {
  async findForApplication(applicationId) {
    const { DATABASE_URL } = getEnv();
    if (!DATABASE_URL) throw new Error("DATABASE_URL must be set");
    const sql = neon(DATABASE_URL);
    const rows = await sql(
      `SELECT id, application_id, job_slug, track, status, score, max_score,
              completed_at, created_at
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
              completed_at, created_at, system_check, responses
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
              completed_at, created_at
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
                 completed_at, created_at`,
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
};
