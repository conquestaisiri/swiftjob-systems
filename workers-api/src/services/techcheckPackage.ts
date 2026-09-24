export const CHECKER_MSI_R2_KEY =
  "private/tech-check/sha256-891cd20daf021cfc407281667be16abf6c6f7ae333d179c3c0b75df4e9d649b0/swiftjob-techchecker.msi";
export const CHECKER_MSI_SHA256 =
  "891CD20DAF021CFC407281667BE16ABF6C6F7AE333D179C3C0B75DF4E9D649B0";
export const CHECKER_LAUNCHER_R2_KEY =
  "private/tech-check/launcher/sha256-89d0228714c5e879f8ce3c92a9c43c760da0222cac6a7cc280035c84e7a7a4ed/SwiftJob-TechCheck-Launcher.exe";
export const CHECKER_LAUNCHER_SHA256 =
  "89D0228714C5E879F8CE3C92A9C43C760DA0222CAC6A7CC280035C84E7A7A4ED";

export const MAX_CHECKER_MSI_BYTES = 16 * 1024 * 1024;
export const MAX_CHECKER_LAUNCHER_BYTES = 8 * 1024 * 1024;
export const CHECKER_BUNDLE_FOOTER_SIZE = 24;
export const CHECKER_BUNDLE_VERSION = 2;

const BUNDLE_MAGIC = new TextEncoder().encode("SJTCBNDL");

const ZIP_CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value++) {
    let crc = value;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

function zipCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = ZIP_CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a standard, uncompressed ZIP containing exactly one named file. */
export function buildSingleFileZip(
  filename: string,
  payload: Uint8Array,
  modifiedAt = new Date(),
): Uint8Array {
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
    throw new TypeError("The ZIP entry name is invalid.");
  }
  const name = new TextEncoder().encode(filename);
  if (
    payload.byteLength <= 0 ||
    payload.byteLength > 0xffffffff ||
    name.byteLength > 0xffff ||
    payload.byteLength + 2 * name.byteLength + 98 > 0xffffffff
  ) {
    throw new RangeError("The ZIP entry has an invalid size.");
  }

  const year = Math.max(1980, Math.min(2107, modifiedAt.getUTCFullYear()));
  const dosTime =
    (modifiedAt.getUTCHours() << 11) |
    (modifiedAt.getUTCMinutes() << 5) |
    Math.floor(modifiedAt.getUTCSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) |
    ((modifiedAt.getUTCMonth() + 1) << 5) |
    modifiedAt.getUTCDate();
  const crc = zipCrc32(payload);

  const localHeader = new Uint8Array(30 + name.byteLength);
  const local = new DataView(localHeader.buffer);
  local.setUint32(0, 0x04034b50, true);
  local.setUint16(4, 20, true);
  local.setUint16(6, 0, true);
  local.setUint16(8, 0, true);
  local.setUint16(10, dosTime, true);
  local.setUint16(12, dosDate, true);
  local.setUint32(14, crc, true);
  local.setUint32(18, payload.byteLength, true);
  local.setUint32(22, payload.byteLength, true);
  local.setUint16(26, name.byteLength, true);
  local.setUint16(28, 0, true);
  localHeader.set(name, 30);

  const centralHeader = new Uint8Array(46 + name.byteLength);
  const central = new DataView(centralHeader.buffer);
  central.setUint32(0, 0x02014b50, true);
  central.setUint16(4, 20, true);
  central.setUint16(6, 20, true);
  central.setUint16(8, 0, true);
  central.setUint16(10, 0, true);
  central.setUint16(12, dosTime, true);
  central.setUint16(14, dosDate, true);
  central.setUint32(16, crc, true);
  central.setUint32(20, payload.byteLength, true);
  central.setUint32(24, payload.byteLength, true);
  central.setUint16(28, name.byteLength, true);
  central.setUint16(30, 0, true);
  central.setUint16(32, 0, true);
  central.setUint16(34, 0, true);
  central.setUint16(36, 0, true);
  central.setUint32(38, 0, true);
  central.setUint32(42, 0, true);
  centralHeader.set(name, 46);

  const centralOffset = localHeader.byteLength + payload.byteLength;
  const endRecord = new Uint8Array(22);
  const end = new DataView(endRecord.buffer);
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, 1, true);
  end.setUint16(10, 1, true);
  end.setUint32(12, centralHeader.byteLength, true);
  end.setUint32(16, centralOffset, true);
  end.setUint16(20, 0, true);

  const archive = new Uint8Array(
    centralOffset + centralHeader.byteLength + endRecord.byteLength,
  );
  archive.set(localHeader, 0);
  archive.set(payload, localHeader.byteLength);
  archive.set(centralHeader, centralOffset);
  archive.set(endRecord, centralOffset + centralHeader.byteLength);
  return archive;
}

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
    "for($attempt=1;$attempt -le 3;$attempt++){try{",
    `  $result=Invoke-RestMethod -Method Post -Uri '${startUrl}' -TimeoutSec 15`,
    "  if($result.ok -ne $true){throw 'The server did not confirm the check start.'}",
    "  exit 0",
    "}catch{",
    "  $status=0;try{if($_.Exception.Response -and $_.Exception.Response.StatusCode){$status=[int]$_.Exception.Response.StatusCode}}catch{}",
    "  if($status -eq 410){$message='This checker download expired or was already used. Return to your application and download a fresh checker.';[IO.File]::WriteAllText($env:SWIFTJOB_TECHCHECK_ERROR,$message,[Text.UTF8Encoding]::new($false));exit 41}",
    "  if($status -gt 0 -and $status -lt 500 -and $status -notin @(408,429)){$message='SwiftJob rejected the check start (HTTP '+$status+'). Return to your application and request a fresh checker.';[IO.File]::WriteAllText($env:SWIFTJOB_TECHCHECK_ERROR,$message,[Text.UTF8Encoding]::new($false));exit 42}",
    "  if($attempt -lt 3){Start-Sleep -Seconds $attempt;continue}",
    "  $message=if($status -ge 500){'SwiftJob could not start the check (server HTTP '+$status+'). Try again shortly; if it repeats, contact support.'}elseif($status -gt 0){'SwiftJob temporarily rejected the start request (HTTP '+$status+'). Check your connection and try again.'}else{'Could not reach SwiftJob after three attempts. Check your internet connection and run a fresh checker.'}",
    "  [IO.File]::WriteAllText($env:SWIFTJOB_TECHCHECK_ERROR,$message,[Text.UTF8Encoding]::new($false));exit 43",
    "}}",
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
