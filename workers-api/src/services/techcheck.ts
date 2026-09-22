import { neon } from "@neondatabase/serverless";
import { getEnv } from "../config";

// One-time Tech Checker infrastructure. Tokens are issued per application,
// embedded in a generated package (Windows .exe / macOS .command), and consumed
// only after the report is submitted.

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
      return { status: "not_started", specs: null, checkedAt: null };
    }
    const completedRow = rows
      .map(ROW)
      .find((row) => Boolean(row.used_at) && isUsableTechCheckReport(row.report));
    if (completedRow?.used_at) {
      return {
        status: "completed",
        specs: completedRow.report,
        checkedAt: completedRow.used_at,
      };
    }
    const row = ROW(rows[0]);
    return {
      status: new Date(row.expires_at).getTime() > Date.now()
        ? "in_progress"
        : "not_started",
      specs: null,
      checkedAt: null,
    };
  },

  async issueToken(
    applicationId: string,
  ): Promise<{ token: string; expiresAt: string }> {
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
    if (!isUsableTechCheckReport(specs)) return false;
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

// The MSI is stored in the Worker-bound R2 bucket under a content-addressed
// key. The generated one-time Windows tool verifies these exact bytes before
// opening Windows Installer.
export const CHECKER_MSI_R2_KEY =
  "private/tech-check/sha256-891cd20daf021cfc407281667be16abf6c6f7ae333d179c3c0b75df4e9d649b0/swiftjob-techchecker.msi";
export const CHECKER_MSI_SHA256 =
  "891CD20DAF021CFC407281667BE16ABF6C6F7AE333D179C3C0B75DF4E9D649B0";
export const CHECKER_LAUNCHER_R2_KEY =
  "private/tech-check/launcher/sha256-7c16e8293600a3d75c13066e5cdc2cd88d44aeaa871d0465d32d2c708320ccd0/SwiftJob-TechCheck-Launcher.exe";
export const CHECKER_LAUNCHER_SHA256 =
  "7C16E8293600A3D75C13066E5CDC2CD88D44AEAA871D0465D32D2C708320CCD0";

export const CHECKER_BUNDLE_FOOTER_SIZE = 24;
const CHECKER_BUNDLE_MAGIC = new TextEncoder().encode("SJTCBNDL");

export function buildWindowsBundleFooter(
  launcherLength: number,
  batchLength: number,
  msiLength: number,
): Uint8Array {
  const lengths = [launcherLength, batchLength, msiLength];
  if (
    lengths.some(
      (length) => !Number.isSafeInteger(length) || length <= 0 || length > 0x7fffffff,
    )
  ) {
    throw new RangeError("The Windows checker package has an invalid component size.");
  }

  const footer = new Uint8Array(CHECKER_BUNDLE_FOOTER_SIZE);
  footer.set(CHECKER_BUNDLE_MAGIC, 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, 1, true);
  view.setInt32(12, launcherLength, true);
  view.setInt32(16, batchLength, true);
  view.setInt32(20, msiLength, true);
  return footer;
}

export function streamWindowsBundle(
  parts: Array<Uint8Array | ReadableStream<Uint8Array>>,
): ReadableStream<Uint8Array> {
  let partIndex = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (partIndex < parts.length) {
          const part = parts[partIndex];
          if (part instanceof Uint8Array) {
            partIndex += 1;
            if (part.byteLength > 0) controller.enqueue(part);
            continue;
          }

          reader ??= part.getReader();
          const result = await reader.read();
          if (result.done) {
            reader.releaseLock();
            reader = null;
            partIndex += 1;
            continue;
          }
          controller.enqueue(result.value);
          return;
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      if (reader) await reader.cancel(reason);
    },
  });
}

/** Legacy Windows script generator retained for already-downloaded checkers. */
export function buildWindowsTool(apiBase: string, token: string): string {
  const msiPath = `%TEMP%\\SwiftJob-TechChecker-${token}.msi`;
  const msiUrl = `${apiBase}/api/tech-check/download/msi/${token}`;
  const downloadPs = [
    "$ErrorActionPreference='Stop'",
    "$ProgressPreference='SilentlyContinue'",
    "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12",
    `Invoke-WebRequest -UseBasicParsing -Uri '${msiUrl}' -OutFile '${msiPath}'`,
  ].join("; ");
  const verifyPs = `$hash=(Get-FileHash -Algorithm SHA256 -LiteralPath '${msiPath}').Hash; if ($hash -ne '${CHECKER_MSI_SHA256}') { exit 1 }`;
  // Single PowerShell command (semicolon-chained), ASCII-only, and without
  // caret continuations so cmd.exe parses it deterministically.
  const reportPs = [
    "$ErrorActionPreference='Stop'",
    "$os=Get-CimInstance Win32_OperatingSystem",
    "$cpu=Get-CimInstance Win32_Processor | Select-Object -First 1",
    "$ram=[math]::Round($os.TotalVisibleMemorySize/1MB,1)",
    "$dsk=Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\"",
    "$free=[math]::Round($dsk.FreeSpace/1GB,1)",
    "$b=@{os=($os.Caption+' '+$os.OSArchitecture);cpu=$cpu.Name;cores=$cpu.NumberOfCores;ramGB=$ram;diskFreeGB=$free}|ConvertTo-Json",
    `Invoke-RestMethod -Method Post -Uri '${apiBase}/api/tech-check/report/${token}' -ContentType 'application/json' -Body $b | Out-Null`,
    "Write-Host ''",
    "Write-Host 'DONE - Check complete! Return to the website to continue.'",
  ].join("; ");
  return `@echo off
setlocal
title SwiftJob.online System Checker
echo ============================================
echo   SwiftJob.online System Checker
echo   One-time installer and system check.
echo ============================================
echo.
set "MSI_PATH=${msiPath}"
echo Downloading the SwiftJob Tech Checker installer...
powershell -NoProfile -Command "${downloadPs.replace(/"/g, '\\"')}"
if errorlevel 1 goto download_failed
powershell -NoProfile -Command "${verifyPs.replace(/"/g, '\\"')}"
if errorlevel 1 goto checksum_failed
echo.
echo The Windows installer will now open. Review it and choose whether to install.
echo The system report is submitted only after the installer completes successfully.
echo.
msiexec.exe /i "%MSI_PATH%"
set "INSTALL_EXIT=%ERRORLEVEL%"
if not "%INSTALL_EXIT%"=="0" if not "%INSTALL_EXIT%"=="3010" if not "%INSTALL_EXIT%"=="1641" goto install_failed
echo.
echo Collecting your system information and sending the one-time report...
powershell -NoProfile -Command "${reportPs.replace(/"/g, '\\"')}"
if errorlevel 1 goto report_failed
del /q "%MSI_PATH%" >nul 2>&1
color 2F
echo.
echo   Success! Close this window and press "Verify report" on the website.
goto finish

:download_failed
del /q "%MSI_PATH%" >nul 2>&1
color 4F
echo.
echo   The installer could not be downloaded. Check your connection and run this file again before it expires.
goto finish

:checksum_failed
del /q "%MSI_PATH%" >nul 2>&1
color 4F
echo.
echo   The installer did not pass its integrity check and was not opened. Contact SwiftJob support.
goto finish

:install_failed
del /q "%MSI_PATH%" >nul 2>&1
color 4F
echo.
echo   The installer did not complete. No system report was sent. Resolve the installer message and try again before this checker expires.
goto finish

:report_failed
del /q "%MSI_PATH%" >nul 2>&1
color 4F
echo.
echo   The installer completed, but the report could not be sent. Check your connection and run this file again before it expires.

:finish
echo.
pause
endlocal
`;
}

/** The compact report runner carried inside the self-extracting Windows package. */
export function buildWindowsBundleBatch(apiBase: string, token: string): string {
  const reportPath = `%SWIFTJOB_TECHCHECK_TEMP%\\system-report.json`;
  const collectPs = [
    "$ErrorActionPreference='Stop'",
    "$os=Get-CimInstance Win32_OperatingSystem",
    "$cpu=Get-CimInstance Win32_Processor | Select-Object -First 1",
    "$ram=[math]::Round($os.TotalVisibleMemorySize/1MB,1)",
    "$dsk=Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DeviceID -eq 'C:' } | Select-Object -First 1",
    "$free=[math]::Round($dsk.FreeSpace/1GB,1)",
    "$b=@{os=($os.Caption+' '+$os.OSArchitecture);cpu=$cpu.Name;cores=$cpu.NumberOfCores;ramGB=$ram;diskFreeGB=$free}|ConvertTo-Json -Compress",
    `[IO.File]::WriteAllText('${reportPath}',$b,[Text.UTF8Encoding]::new($false))`,
  ].join("; ");
  const submitPs = [
    "$ErrorActionPreference='Stop'",
    `$path='${reportPath}'`,
    "if (!(Test-Path -LiteralPath $path)) { throw 'The collected system report is missing.' }",
    "$body=[IO.File]::ReadAllText($path)",
    `Invoke-RestMethod -Method Post -Uri '${apiBase}/api/tech-check/report/${token}' -ContentType 'application/json' -Body $body | Out-Null`,
    "Remove-Item -LiteralPath $path -Force",
  ].join("; ");

  return `@echo off
setlocal
if not defined SWIFTJOB_TECHCHECK_TEMP exit /b 3
if /i "%~1"=="collect" goto collect
if /i "%~1"=="submit" goto submit
exit /b 2

:collect
powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -Command "${collectPs.replace(/"/g, '\\"')}"
if errorlevel 1 exit /b 1
exit /b 0

:submit
powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -Command "${submitPs.replace(/"/g, '\\"')}"
if errorlevel 1 exit /b 1
exit /b 0
`;
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
BODY=$(printf '{"os":"%s","cpu":"%s","ramGB":%d,"screen":"%s"}' \\
  "$OS" "$CPU" "$RAM_GB" "$SCREEN")

curl -s -X POST "${apiBase}/api/tech-check/report/${token}" \\
  -H 'Content-Type: application/json' -d "$BODY" >/dev/null

echo
echo "DONE - Check complete! You can close this window and return to the website."
read -n 1 -s -r -p "Press any key to close..."
`;
}
