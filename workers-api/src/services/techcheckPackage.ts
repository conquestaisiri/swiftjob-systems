export const CHECKER_MSI_R2_KEY =
  "private/tech-check/sha256-891cd20daf021cfc407281667be16abf6c6f7ae333d179c3c0b75df4e9d649b0/swiftjob-techchecker.msi";
export const CHECKER_MSI_SHA256 =
  "891CD20DAF021CFC407281667BE16ABF6C6F7AE333D179C3C0B75DF4E9D649B0";
export const CHECKER_LAUNCHER_R2_KEY =
  "private/tech-check/launcher/sha256-f146911aac6bd9322564c4d834973e8c6ea12850f33b5be650f6f14c22c18b3a/SwiftJob-TechCheck-Launcher.exe";
export const CHECKER_LAUNCHER_SHA256 =
  "F146911AAC6BD9322564C4D834973E8C6EA12850F33B5BE650F6F14C22C18B3A";

export const MAX_CHECKER_MSI_BYTES = 16 * 1024 * 1024;
export const MAX_CHECKER_LAUNCHER_BYTES = 8 * 1024 * 1024;
export const CHECKER_BUNDLE_FOOTER_SIZE = 24;
export const CHECKER_BUNDLE_VERSION = 2;

const BUNDLE_MAGIC = new TextEncoder().encode("SJTCBNDL");

export function buildWindowsBundleFooter(
  launcherLength: number,
  batchLength: number,
  msiLength: number,
): Uint8Array {
  const lengths = [launcherLength, batchLength, msiLength];
  if (
    lengths.some(
      (length) =>
        !Number.isSafeInteger(length) || length <= 0 || length > 0x7fffffff,
    )
  ) {
    throw new RangeError("The Windows checker package has an invalid component size.");
  }

  const footer = new Uint8Array(CHECKER_BUNDLE_FOOTER_SIZE);
  footer.set(BUNDLE_MAGIC, 0);
  const view = new DataView(footer.buffer);
  view.setUint32(8, CHECKER_BUNDLE_VERSION, true);
  view.setInt32(12, launcherLength, true);
  view.setInt32(16, batchLength, true);
  view.setInt32(20, msiLength, true);
  return footer;
}

/** Stream the launcher's single-file format: launcher + checker BAT + MSI + footer. */
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

/**
 * After the candidate confirms the disclosed inventory, the launcher gathers
 * it locally while the normal MSI is open, then submits only after that exact
 * installer process reports success. No stress benchmark or device-unique
 * identifier is collected.
 */
export function buildWindowsBundleBatch(apiBase: string, token: string): string {
  if (!/^[a-f0-9]{48}$/i.test(token)) {
    throw new TypeError("The one-time checker token is invalid.");
  }

  const api = new URL(apiBase);
  const isLocalApi = ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname);
  if (api.protocol !== "https:" && !(api.protocol === "http:" && isLocalApi)) {
    throw new TypeError("The checker API must use a secure connection.");
  }

  const reportUrl = new URL(
    `/api/tech-check/report/${token}`,
    api,
  ).toString();
  const startUrl = new URL(`/api/tech-check/start/${token}`, api).toString();
  const collectPs = [
    "$ErrorActionPreference='Stop'",
    "$os=Get-CimInstance -ClassName Win32_OperatingSystem",
    "$cs=Get-CimInstance -ClassName Win32_ComputerSystem",
    "$enclosure=Get-CimInstance -ClassName Win32_SystemEnclosure -ErrorAction SilentlyContinue | Select-Object -First 1",
    "$chassis=@($enclosure.ChassisTypes)",
    "$isLaptop=($cs.PCSystemType -eq 2) -or (@($chassis | Where-Object { $_ -in @(8,9,10,14,30,31,32) }).Count -gt 0)",
    "$isDesktop=($cs.PCSystemType -in @(1,3)) -or (@($chassis | Where-Object { $_ -in @(3,4,5,6,7,13) }).Count -gt 0)",
    "$deviceType=if ($isLaptop) {'Laptop / portable'} elseif ($isDesktop) {'Desktop / workstation'} else {'Other / unknown'}",
    "$cpus=@(Get-CimInstance -ClassName Win32_Processor)",
    "$cpuNames=(@($cpus | ForEach-Object { ([string]$_.Name).Trim() } | Where-Object { $_ } | Select-Object -Unique) -join ' / ')",
    "$cores=[int](($cpus | Measure-Object -Property NumberOfCores -Sum).Sum)",
    "$threads=[int](($cpus | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum)",
    "$maxClockMHz=($cpus | Measure-Object -Property MaxClockSpeed -Maximum).Maximum",
    "$maxClockGHz=if ($maxClockMHz) {[math]::Round($maxClockMHz/1000,2)} else {$null}",
    "$ramGB=[math]::Round($cs.TotalPhysicalMemory/1GB,1)",
    "$ramAvailableGB=[math]::Round($os.FreePhysicalMemory/1MB,1)",
    "$gpus=@(Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue)",
    "$gpu=(@($gpus | Select-Object -First 4 | ForEach-Object { $name=([string]$_.Name).Trim(); $driver=([string]$_.DriverVersion).Trim(); $memory=if ($_.AdapterRAM -gt 0) {[math]::Round($_.AdapterRAM/1GB,1)} else {$null}; $description=$name; if ($driver) {$description += ' / driver '+$driver}; if ($memory) {$description += ' / reported memory '+$memory+' GB'}; $description }) -join '; ')",
    "$disks=@(Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue | Where-Object { $_.Size -gt 0 })",
    "$storage=(@($disks | ForEach-Object { '{0} {1} GB total, {2} GB free' -f $_.DeviceID,[math]::Round($_.Size/1GB,1),[math]::Round($_.FreeSpace/1GB,1) }) -join '; ')",
    "$storageTotalGB=[math]::Round((($disks | Measure-Object -Property Size -Sum).Sum)/1GB,1)",
    "$storageFreeGB=[math]::Round((($disks | Measure-Object -Property FreeSpace -Sum).Sum)/1GB,1)",
    "$systemDrive=Get-CimInstance -ClassName Win32_LogicalDisk -Filter \"DeviceID='$($env:SystemDrive)'\" -ErrorAction SilentlyContinue | Select-Object -First 1",
    "$diskFreeGB=if ($systemDrive) {[math]::Round($systemDrive.FreeSpace/1GB,1)} else {$null}",
    "$winSat=Get-CimInstance -ClassName Win32_WinSAT -ErrorAction SilentlyContinue | Select-Object -First 1",
    "$benchmark='Windows WinSAT score is not available on this computer'",
    "if ($winSat -and $winSat.WinSPRLevel -gt 0) {$benchmark=('Existing Windows System Assessment score - base {0}; CPU {1}; memory {2}; graphics {3}; 3D graphics {4}; disk {5}' -f $winSat.WinSPRLevel,$winSat.CPUScore,$winSat.MemoryScore,$winSat.GraphicsScore,$winSat.D3DScore,$winSat.DiskScore)}",
    "$report=[ordered]@{deviceType=$deviceType;manufacturer=([string]$cs.Manufacturer).Trim();model=([string]$cs.Model).Trim();os=([string]$os.Caption).Trim();osVersion=[string]$os.Version;osBuild=[string]$os.BuildNumber;systemArchitecture=[string]$os.OSArchitecture;systemType=[string]$cs.SystemType;cpu=$cpuNames;cores=$cores;threads=$threads;cpuMaxGHz=$maxClockGHz;ramGB=$ramGB;ramAvailableGB=$ramAvailableGB;gpu=$gpu;storage=$storage;storageTotalGB=$storageTotalGB;storageFreeGB=$storageFreeGB;diskFreeGB=$diskFreeGB;benchmark=$benchmark;checkedAt=[DateTime]::UtcNow.ToString('o')}",
    "$json=$report | ConvertTo-Json -Compress -Depth 3",
    "[IO.File]::WriteAllText($env:SWIFTJOB_TECHCHECK_REPORT,$json,[Text.UTF8Encoding]::new($false))",
  ].join("; ");
  const startPs = [
    "$ErrorActionPreference='Stop'",
    `Invoke-RestMethod -Method Post -Uri '${startUrl}' | Out-Null`,
  ].join("; ");
  const submitPs = [
    "$ErrorActionPreference='Stop'",
    "$path=$env:SWIFTJOB_TECHCHECK_REPORT",
    "if (!(Test-Path -LiteralPath $path)) {throw 'The collected system report is missing.'}",
    "$body=[IO.File]::ReadAllText($path)",
    `Invoke-RestMethod -Method Post -Uri '${reportUrl}' -ContentType 'application/json' -Body $body | Out-Null`,
    "Remove-Item -LiteralPath $path -Force",
  ].join("; ");

  return `@echo off
setlocal
if not defined SWIFTJOB_TECHCHECK_TEMP exit /b 3
if /i "%~1"=="collect" goto collect
if /i "%~1"=="start" goto start
if /i "%~1"=="submit" goto submit
exit /b 2

:collect
powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -Command "${collectPs.replace(/"/g, '\\"')}"
if errorlevel 1 exit /b 1
exit /b 0

:start
powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -Command "${startPs.replace(/"/g, '\\"')}"
if errorlevel 1 exit /b 1
exit /b 0

:submit
powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -Command "${submitPs.replace(/"/g, '\\"')}"
if errorlevel 1 exit /b 1
exit /b 0
`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("").toUpperCase();
}
