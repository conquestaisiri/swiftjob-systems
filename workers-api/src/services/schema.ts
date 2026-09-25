import { neon } from "@neondatabase/serverless";
import { getEnv } from "../config";

// Schema evolution is owned by workers-api/migrations and is run before a
// deployment. This read-only check is a startup guard: it makes a missing or
// partially applied migration fail clearly without changing production data.
const REQUIRED_TABLES = [
  "applications",
  "jobs",
  "magic_tokens",
  "candidate_sessions",
  "candidate_accounts",
  "referrals",
  "referral_content",
  "referral_settings",
  "referral_clicks",
  "contacts",
  "campaigns",
  "campaign_visits",
  "assessments",
  "footprints",
  "activities",
  "tech_check_tokens",
  "candidate_profiles",
  "candidate_referral_links",
  "candidate_referrals",
  "email_unsubscriptions",
  "email_delivery_events",
  "email_provider_suppressions",
] as const;

const REQUIRED_COLUMNS = [
  ["applications", "job_slug"],
  ["applications", "submission_key"],
  ["applications", "campaign_slug"],
  ["applications", "referral_code"],
  ["applications", "role_answers"],
  ["jobs", "referral_reward_cents"],
  ["jobs", "application_questions"],
  ["referrals", "content_overrides"],
  ["footprints", "meta"],
  ["email_delivery_events", "provider_event_id"],
  ["email_delivery_events", "email_id"],
  ["email_delivery_events", "event_type"],
  ["email_delivery_events", "occurred_at"],
  ["email_provider_suppressions", "email"],
  ["email_provider_suppressions", "reason"],
  ["email_provider_suppressions", "source_event_id"],
] as const;

let schemaPromise: Promise<void> | null = null;

async function verifySchema(): Promise<void> {
  const { DATABASE_URL } = getEnv();
  const sql = neon(DATABASE_URL);
  // Keep this to one metadata round-trip on a cold isolate. The guard runs
  // before the first request each time an isolate starts, so two catalog
  // queries would add avoidable latency to every new edge isolate.
  const rows = await sql(
    `SELECT 'table' AS kind, table_name AS name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])
     UNION ALL
     SELECT 'column' AS kind, table_name || '.' || column_name AS name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'applications' AND column_name IN ('job_slug', 'submission_key', 'campaign_slug', 'role_answers'))
        OR (table_name = 'referrals' AND column_name = 'content_overrides')
          OR (table_name = 'applications' AND column_name = 'referral_code')
          OR (table_name = 'jobs' AND column_name IN ('referral_reward_cents', 'application_questions'))
          OR (table_name = 'footprints' AND column_name = 'meta')
          OR (table_name = 'email_delivery_events' AND column_name IN ('provider_event_id', 'email_id', 'event_type', 'occurred_at'))
          OR (table_name = 'email_provider_suppressions' AND column_name IN ('email', 'reason', 'source_event_id')))`,
    [Array.from(REQUIRED_TABLES)],
  );
  const foundTables = new Set(
    rows.filter((row) => row.kind === "table").map((row) => String(row.name)),
  );
  const missingTables = REQUIRED_TABLES.filter((name) => !foundTables.has(name));
  const foundColumns = new Set(
    rows
      .filter((row) => row.kind === "column")
      .map((row) => String(row.name)),
  );
  const missingColumns = REQUIRED_COLUMNS.filter(
    ([table, column]) => !foundColumns.has(`${table}.${column}`),
  ).map(([table, column]) => `${table}.${column}`);

  if (missingTables.length || missingColumns.length) {
    const missing = [...missingTables, ...missingColumns].join(", ");
    throw new Error(
      `Required database schema is incomplete (${missing}). Run the ordered workers-api migrations before deploying.`,
    );
  }
}

/** Verify the schema once per Worker isolate without performing any DDL. */
export function verifySchemaOnce(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = verifySchema().catch((error) => {
      // Do not cache a transient connectivity failure forever; a later
      // request may succeed after the database becomes reachable.
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}
