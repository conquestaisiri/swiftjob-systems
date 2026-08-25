import { neon } from "@neondatabase/serverless";
import { getEnv } from "../config";

// One-time Tech Checker infrastructure. Tokens are issued per application,
// embedded in a generated tool (Windows .bat / macOS .command), and consumed
// the moment the tool reports back — after that the download is dead.

const TECH_CHECK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tech_check_tokens (
  token_hash text PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  report jsonb
);
CREATE INDEX IF NOT EXISTS idx_tech_check_app ON tech_check_tokens (application_id);
`;

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

async function runSchema(): Promise<void> {
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) throw new Error("DATABASE_URL must be set");
  const sql = neon(DATABASE_URL);
  for (const statement of TECH_CHECK_SCHEMA_SQL.split(";")) {
    const trimmed = statement.trim();
    if (trimmed) await sql(trimmed);
  }
}

export function ensureTechCheckSchemaOnce(): Promise<void> {
  if (schemaEnsured) return Promise.resolve();
  if (!schemaPromise) {
    schemaPromise = runSchema().then(() => {
      schemaEnsured = true;
    });
  }
  return schemaPromise;
}

const TTL_MS = 30 * 60 * 1000; // 30 minutes

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

const ROW = (r: Record<string, unknown>): TokenRow => r as unknown as TokenRow;

export const techCheckService = {
  async issueToken(
    applicationId: string,
  ): Promise<{ token: string; expiresAt: string }> {
    await ensureTechCheckSchemaOnce();
    const { DATABASE_URL } = getEnv();
    const sql = neon(DATABASE_URL);
    // Retire any outstanding tokens for this application — one live tool at a
    // time keeps the flow unambiguous.
    await sql(
      `UPDATE tech_check_tokens SET expires_at = now()
       WHERE application_id = $1 AND used_at IS NULL AND expires_at > now()`,
      [applicationId],
    );
    const token = randomToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + TTL_MS);
    await sql(
      `INSERT INTO tech_check_tokens (token_hash, application_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, applicationId, expiresAt.toISOString()],
    );
    return { token, expiresAt: expiresAt.toISOString() };
  },

  async getStatus(token: string): Promise<{
    valid: boolean;
    used: boolean;
    expired: boolean;
    specs: Record<string, unknown> | null;
  } | null> {
    await ensureTechCheckSchemaOnce();
    const { DATABASE_URL } = getEnv();
    const sql = neon(DATABASE_URL);
    const rows = await sql(
      `SELECT * FROM tech_check_tokens WHERE token_hash = $1 LIMIT 1`,
      [await hashToken(token)],
    );
    if (!rows || rows.length === 0) return null;
    const row = ROW(rows[0]);
    const expired = new Date(row.expires_at).getTime() < Date.now();
    return {
      valid: !expired,
      used: Boolean(row.used_at),
      expired,
      specs: row.report ?? null,
    };
  },

  /** Consume the token and store the tool's report. Single-use: a second
   *  report (or reuse of the tool) finds no unconsumed row and fails. */
  async consumeWithReport(
    token: string,
    specs: Record<string, unknown>,
  ): Promise<boolean> {
    await ensureTechCheckSchemaOnce();
    const { DATABASE_URL } = getEnv();
    const sql = neon(DATABASE_URL);
    const result = await sql(
      `UPDATE tech_check_tokens
       SET used_at = now(), report = $2::jsonb
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING token_hash`,
      [await hashToken(token), JSON.stringify(specs)],
    );
    return Boolean(result && result.length > 0);
  },
};

// ============================================
// Tool generators
// ============================================

export type TechPlatform = "windows" | "macos";

/** Windows batch tool: collects core specs, POSTs them once, then self-retires
 *  (the server consumes the token on first report — running it again fails). */
export function buildWindowsTool(apiBase: string, token: string): string {
  // Single PowerShell command (semicolon-chained) — no caret continuations,
  // no percent-escapes, ASCII-only, so cmd.exe parses it deterministically.
  const ps = [
    "$ErrorActionPreference='Stop'",
    "$os=Get-CimInstance Win32_OperatingSystem",
    "$cpu=Get-CimInstance Win32_Processor | Select-Object -First 1",
    "$ram=[math]::Round($os.TotalVisibleMemorySize/1MB,1)",
    "$dsk=Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\"",
    "$free=[math]::Round($dsk.FreeSpace/1GB,1)",
    "$b=@{os=($os.Caption+' '+$os.OSArchitecture);cpu=$cpu.Name;cores=$cpu.NumberOfCores;ramGB=$ram;diskFreeGB=$free;hostname=$env:COMPUTERNAME}|ConvertTo-Json",
    `Invoke-RestMethod -Method Post -Uri '${apiBase}/api/tech-check/report/${token}' -ContentType 'application/json' -Body $b | Out-Null`,
    "Write-Host ''",
    "Write-Host 'DONE - Check complete! Return to the website to continue.'",
    "exit 0",
  ].join("; ");
  return `@echo off
title SwiftJob System Checker
echo ============================================
echo   SwiftJob System Checker
echo   One-time check - this tool works only ONCE.
echo ============================================
echo.
echo Collecting your system information (~15 seconds)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '\\"')}"
if %errorlevel%==0 (
  echo.
  color 2F
  echo   Success! Close this window and press
  echo   "I ran it" on the website to continue.
) else (
  echo.
  color 4F
  echo   Could not reach SwiftJob servers. Check your internet connection and run this file once more while it still works.
)
echo.
pause
`;
}

// --- Backblaze B2 signed URL for the combined MSI (SwiftTechCheck.msi) ---
// Returns a 15-min download link, or null if B2 is not configured.
export async function getSignedMsiUrl(): Promise<string | null> {
  const env = getEnv() as unknown as Record<string, string | undefined>;
  const { B2_KEY_ID, B2_APP_KEY, B2_BUCKET_ID } = env;
  // Backblaze file + bucket are fixed — only the link is short-lived.
  const FILE_NAME = "SwiftTechCheck.msi";
  const apiUrl = env.B2_API_URL ?? "https://api.backblazeb2.com";
  const dlBase = env.B2_DOWNLOAD_URL ?? "https://f005.backblazeb2.com";
  const bucketId = B2_BUCKET_ID ?? "35a54763b3883991a8060f14";
  const bucketName = env.B2_BUCKET_NAME ?? "Swift-Private";
  if (!B2_KEY_ID || !B2_APP_KEY) return null;
  try {
    const authResp = await fetch(`${apiUrl}/b2api/v3/b2_authorize_account`, {
      headers: { Authorization: `Basic ${btoa(`${B2_KEY_ID}:${B2_APP_KEY}`)}` },
    });
    if (!authResp.ok) return null;
    const auth = (await authResp.json()) as { authorizationToken: string; apiUrl: string };
    const daResp = await fetch(
      `${auth.apiUrl}/b2api/v3/b2_get_download_authorization?bucketId=${bucketId}&fileNamePrefix=${encodeURIComponent(FILE_NAME)}&validDurationInSeconds=900`,
      { headers: { Authorization: auth.authorizationToken } },
    );
    if (!daResp.ok) return null;
    const da = (await daResp.json()) as { authorizationToken: string };
    return `${dlBase}/file/${bucketName}/${FILE_NAME}?Authorization=${da.authorizationToken}`;
  } catch {
    return null;
  }
}

/** MSI launcher — tiny .bat that downloads the combined MSI via a signed URL
 *  and runs it silently with the per-person token. Internet-mark is stripped
 *  before msiexec so SmartScreen does not appear. */
export function buildMsiLauncher(apiBase: string, token: string, signedMsiUrl: string): string {
  const checkinUrl = `${apiBase}/api/tech-check/report/${token}`;
  // The MSI itself contains the tech checker (CustomAction Type 6) and consumes
  // the token on its first run — same single-use contract as the raw .bat tool.
  return `@echo off\r\ntitle SwiftJob System Checker\r\n` +
    `echo ============================================\r\n` +
    `echo   SwiftJob System Checker\r\n` +
    `echo   This installer works ONCE for this application.\r\n` +
    `echo ============================================\r\n` +
    `echo.\r\n` +
    `echo Downloading installer (~7MB)...\r\n` +
    `curl.exe -L -o "%TEMP%\\SwiftTechCheck.msi" "${signedMsiUrl.replace(/"/g, '""')}"\r\n` +
    `if %errorlevel% neq 0 (\r\n` +
    `  echo Download failed - check your internet connection and run this file again.\r\n` +
    `  pause\r\n` +
    `  exit /b 1\r\n` +
    `)\r\n` +
    `powershell -NoProfile -Command "Unblock-File -Path '%TEMP%\\SwiftTechCheck.msi'"\r\n` +
    `echo Installing - this may take a minute, please wait...\r\n` +
    `msiexec /i "%TEMP%\\SwiftTechCheck.msi" TECHCHECK_TOKEN=${token} CHECKIN_URL=${checkinUrl} /passive\r\n` +
    `echo.\r\n` +
    `echo Check complete! You can close this window and return to the website.\r\n` +
    `echo (If the app asks you to restart, you may do so now.)\r\n` +
    `pause\r\n`;
}

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
HOST="$(hostname -s)"

BODY=$(printf '{"os":"%s","cpu":"%s","ramGB":%d,"screen":"%s","hostname":"%s"}' \\
  "$OS" "$CPU" "$RAM_GB" "$SCREEN" "$HOST")

curl -s -X POST "${apiBase}/api/tech-check/report/${token}" \\
  -H 'Content-Type: application/json' -d "$BODY" >/dev/null

echo
echo "DONE - Check complete! You can close this window and return to the website."
read -n 1 -s -r -p "Press any key to close..."
`;
}
