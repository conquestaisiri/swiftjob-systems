import { neon } from "@neondatabase/serverless";
import { getEnv } from "../config";

export { CHECKER_MSI_R2_KEY, CHECKER_MSI_SHA256 } from "./techcheckPackage";

// One-time Tech Checker infrastructure. Tokens are issued per application,
// embedded in the single-file Windows executable or macOS .command, and
// consumed after submission.

const DOWNLOAD_TTL_MS = 30 * 60 * 1000; // 30 minutes to start the downloaded checker
export const INSTALL_WINDOW_MS = 10 * 60 * 1000; // 10 minutes after MSI launch
const STARTED_AT_REPORT_KEY = "__swiftjobStartedAt";

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

interface TokenRow {
  token_hash: string;
  application_id: string;
  used_at: string | null;
  expires_at: string;
  report: Record<string, unknown> | null;
}

export class TechCheckAlreadyRunningError extends Error {
  constructor() {
    super("A technical check is already running for this application.");
    this.name = "TechCheckAlreadyRunningError";
  }
}

const ROW = (r: Record<string, unknown>): TokenRow => r as unknown as TokenRow;

function getStoredStartTime(report: Record<string, unknown> | null): string | null {
  const value = report?.[STARTED_AT_REPORT_KEY];
  return typeof value === "string" ? value : null;
}

function publicSystemReport(
  report: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!report) return null;
  const visible = { ...report };
  delete visible[STARTED_AT_REPORT_KEY];
  return visible;
}

export function isUsableTechCheckReport(
  report: unknown,
): report is Record<string, unknown> {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return false;
  }
  const details = report as Record<string, unknown>;
  const hasOperatingSystem =
    typeof details.os === "string" && details.os.trim().length > 0;
  const hasHardwareDetail =
    (typeof details.cpu === "string" && details.cpu.trim().length > 0) ||
    (typeof details.ramGB === "number" &&
      Number.isFinite(details.ramGB) &&
      details.ramGB > 0);
  return hasOperatingSystem && hasHardwareDetail;
}

export const techCheckService = {
  async getApplicationStatus(applicationId: string): Promise<{
    status: "not_started" | "in_progress" | "completed";
    specs: Record<string, unknown> | null;
    checkedAt: string | null;
    startedAt: string | null;
    expiresAt: string | null;
    expired: boolean;
  }> {
    const { DATABASE_URL } = getEnv();
    const sql = neon(DATABASE_URL);
    const rows = await sql(
      `SELECT used_at, expires_at, report
       FROM tech_check_tokens
       WHERE application_id = $1
       ORDER BY created_at DESC`,
      [applicationId],
    );
    if (!rows || rows.length === 0) {
      return {
        status: "not_started",
        specs: null,
        checkedAt: null,
        startedAt: null,
        expiresAt: null,
        expired: false,
      };
    }
    const completedRow = rows
      .map(ROW)
      .find((row) => Boolean(row.used_at) && isUsableTechCheckReport(row.report));
    if (completedRow?.used_at) {
      return {
        status: "completed",
        specs: publicSystemReport(completedRow.report)!,
        checkedAt: completedRow.used_at,
        startedAt: getStoredStartTime(completedRow.report),
        expiresAt: completedRow.expires_at,
        expired: false,
      };
    }
    const row = ROW(rows[0]);
    const expired = new Date(row.expires_at).getTime() <= Date.now();
    return {
      status: expired ? "not_started" : "in_progress",
      specs: null,
      checkedAt: null,
      startedAt: getStoredStartTime(row.report),
      expiresAt: row.expires_at,
      expired,
    };
  },

  async issueToken(
    applicationId: string,
  ): Promise<{ token: string; expiresAt: string }> {
    const { DATABASE_URL } = getEnv();
    const sql = neon(DATABASE_URL);
    const active = await sql(
      `SELECT expires_at FROM tech_check_tokens
       WHERE application_id = $1 AND used_at IS NULL
         AND report->>'${STARTED_AT_REPORT_KEY}' IS NOT NULL
         AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [applicationId],
    );
    if (active.length > 0) throw new TechCheckAlreadyRunningError();
    // Retire any outstanding tokens for this application — one live tool at a
    // time keeps the flow unambiguous.
    await sql(
      `UPDATE tech_check_tokens SET expires_at = now()
       WHERE application_id = $1 AND used_at IS NULL AND expires_at > now()`,
      [applicationId],
    );
    const token = randomToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_MS);
    await sql(
      `INSERT INTO tech_check_tokens (token_hash, application_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, applicationId, expiresAt.toISOString()],
    );
    return { token, expiresAt: expiresAt.toISOString() };
  },

  /** Start the install window once; retries keep the original deadline. */
  async start(token: string): Promise<{
    startedAt: string;
    expiresAt: string;
  } | null> {
    if (!/^[a-f0-9]{48}$/i.test(token)) return null;
    const { DATABASE_URL } = getEnv();
    const sql = neon(DATABASE_URL);
    const rows = await sql(
      `UPDATE tech_check_tokens
       SET report = CASE
             WHEN report->>'${STARTED_AT_REPORT_KEY}' IS NULL
               THEN jsonb_set(
                 COALESCE(report, '{}'::jsonb),
                 '{${STARTED_AT_REPORT_KEY}}',
                 to_jsonb(now()::text),
                 true
               )
             ELSE report
           END,
           expires_at = CASE
             WHEN report->>'${STARTED_AT_REPORT_KEY}' IS NULL
               THEN now() + ($2::int * interval '1 millisecond')
             ELSE expires_at
           END
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING report->>'${STARTED_AT_REPORT_KEY}' AS started_at, expires_at`,
      [await hashToken(token), INSTALL_WINDOW_MS],
    );
    if (!rows || rows.length === 0) return null;
    return {
      startedAt: String(rows[0].started_at),
      expiresAt: String(rows[0].expires_at),
    };
  },

  async getStatus(token: string): Promise<{
    valid: boolean;
    used: boolean;
    expired: boolean;
    startedAt: string | null;
    expiresAt: string;
    specs: Record<string, unknown> | null;
  } | null> {
    if (!/^[a-f0-9]{48}$/i.test(token)) return null;
    const { DATABASE_URL } = getEnv();
    const sql = neon(DATABASE_URL);
    const rows = await sql(
      `SELECT * FROM tech_check_tokens WHERE token_hash = $1 LIMIT 1`,
      [await hashToken(token)],
    );
    if (!rows || rows.length === 0) return null;
    const row = ROW(rows[0]);
    const expired = new Date(row.expires_at).getTime() <= Date.now();
    return {
      valid: !expired,
      used: Boolean(row.used_at),
      expired,
      startedAt: getStoredStartTime(row.report),
      expiresAt: row.expires_at,
      specs: row.used_at ? publicSystemReport(row.report) : null,
    };
  },

  /** Consume the token and store the tool's report. Single-use: a second
   *  report (or reuse of the tool) finds no unconsumed row and fails. */
  async consumeWithReport(
    token: string,
    specs: Record<string, unknown>,
  ): Promise<string | null> {
    if (!/^[a-f0-9]{48}$/i.test(token) || !isUsableTechCheckReport(specs)) {
      return null;
    }
    const { DATABASE_URL } = getEnv();
    const sql = neon(DATABASE_URL);
    const result = await sql(
      `UPDATE tech_check_tokens
       SET used_at = now(),
           report = $2::jsonb || jsonb_build_object(
             '${STARTED_AT_REPORT_KEY}',
             report->>'${STARTED_AT_REPORT_KEY}'
           )
       WHERE token_hash = $1 AND used_at IS NULL
         AND report->>'${STARTED_AT_REPORT_KEY}' IS NOT NULL
         AND expires_at > now()
       RETURNING application_id`,
      [await hashToken(token), JSON.stringify(specs)],
    );
    return result?.[0]?.application_id
      ? String(result[0].application_id)
      : null;
  },
};

// ============================================
// Tool generators
// ============================================

export type TechPlatform = "windows" | "macos";

/** macOS tool equivalent. */
export function buildMacTool(apiBase: string, token: string): string {
  return `#!/bin/bash
echo "============================================"
echo "  SwiftJob System Checker"
echo "  One-time check - this tool works only once."
echo "============================================"
echo
echo "Collecting your system information..."

OS="$(sw_vers -productName) $(sw_vers -productVersion)"
CPU="$(sysctl -n machdep.cpu.brand_string)"
RAM_GB=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
SCREEN=$(system_profiler SPDisplaysDataType 2>/dev/null | grep -m1 Resolution | awk '{print $2" x "$4}')
BODY=$(printf '{"os":"%s","cpu":"%s","ramGB":%d,"screen":"%s"}' \\
  "$OS" "$CPU" "$RAM_GB" "$SCREEN")

if ! curl --fail --silent --show-error -X POST "${apiBase}/api/tech-check/start/${token}" >/dev/null; then
  echo "Could not start this one-time check. Check your connection and try again."
  exit 1
fi

curl --fail --silent --show-error -X POST "${apiBase}/api/tech-check/report/${token}" \\
  -H 'Content-Type: application/json' -d "$BODY" >/dev/null

echo
echo "DONE - Check complete! You can close this window and return to the website."
read -n 1 -s -r -p "Press any key to close..."
`;
}
