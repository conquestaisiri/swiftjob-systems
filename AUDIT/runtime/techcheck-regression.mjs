import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarness } from './harness.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(path.join(root, 'artifacts/swiftjob-systems/package.json'));
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
const h = await createHarness();
const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); }
}

const packageSource = await readFile(new URL('../../workers-api/src/services/techcheckPackage.ts', import.meta.url), 'utf8');
const transformed = await esbuild.transform(packageSource, { loader: 'ts', format: 'esm' });
const checkerPackage = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`);
const fixtureLauncher = new TextEncoder().encode('synthetic launcher fixture; never executed');
const fixtureMsi = new TextEncoder().encode('synthetic MSI fixture bytes; never inspected or executed');
const batch = checkerPackage.buildWindowsBundleBatch('https://api.example.test', 'a'.repeat(48));
const fixtureBatch = new TextEncoder().encode(batch);
const footer = checkerPackage.buildWindowsBundleFooter(
  fixtureLauncher.byteLength,
  fixtureBatch.byteLength,
  fixtureMsi.byteLength,
);
const bundle = new Uint8Array(await new Response(checkerPackage.streamWindowsBundle([
  fixtureLauncher,
  fixtureBatch,
  fixtureMsi,
  footer,
])).arrayBuffer());

check('Windows package is one self-contained executable bundle, not an archive', () => {
  assert.notEqual(new DataView(bundle.buffer).getUint32(0, true), 0x04034b50);
  assert.deepEqual(bundle.subarray(0, fixtureLauncher.length), fixtureLauncher);
  const batchStart = fixtureLauncher.length;
  assert.deepEqual(bundle.subarray(batchStart, batchStart + fixtureBatch.length), fixtureBatch);
  const msiStart = batchStart + fixtureBatch.length;
  assert.deepEqual(bundle.subarray(msiStart, msiStart + fixtureMsi.length), fixtureMsi);
  const footerStart = bundle.length - checkerPackage.CHECKER_BUNDLE_FOOTER_SIZE;
  assert.deepEqual(bundle.subarray(footerStart), footer);
  const footerView = new DataView(bundle.buffer, footerStart, footer.byteLength);
  assert.equal(new TextDecoder().decode(bundle.subarray(footerStart, footerStart + 8)), 'SJTCBNDL');
  assert.equal(footerView.getUint32(8, true), checkerPackage.CHECKER_BUNDLE_VERSION);
  assert.equal(footerView.getUint32(8, true), 2);
  assert.equal(footerView.getUint32(12, true), fixtureLauncher.length);
  assert.equal(footerView.getUint32(16, true), fixtureBatch.length);
  assert.equal(footerView.getUint32(20, true), fixtureMsi.length);
});

check('Windows package protocol is versioned and the launcher key is content-addressed', () => {
  assert.equal(checkerPackage.CHECKER_BUNDLE_VERSION, 2);
  assert.match(checkerPackage.CHECKER_LAUNCHER_R2_KEY, /sha256-[a-f0-9]{64}/);
  assert.match(checkerPackage.CHECKER_LAUNCHER_SHA256, /^[A-F0-9]{64}$/);
});

check('Windows checker collects detailed hardware, OS, storage, and available WinSAT data', () => {
  assert.match(batch, /Win32_ComputerSystem/);
  assert.match(batch, /Win32_SystemEnclosure/);
  assert.match(batch, /Win32_Processor/);
  assert.match(batch, /Win32_VideoController/);
  assert.match(batch, /Win32_LogicalDisk/);
  assert.match(batch, /Win32_WinSAT/);
  for (const field of ['deviceType', 'manufacturer', 'model', 'osBuild', 'threads', 'cpuMaxGHz', 'ramAvailableGB', 'gpu', 'storage', 'benchmark']) {
    assert.match(batch, new RegExp(`${field}=`));
  }
});

check('Windows runner uses its collect/submit steps and does not run a stress benchmark', () => {
  assert.match(batch, /"collect" goto collect/);
  assert.match(batch, /"start" goto start/);
  assert.match(batch, /"submit" goto submit/);
  assert.match(batch, /api\/tech-check\/start\//);
  assert.match(batch, /Invoke-RestMethod -Method Post/);
  assert.match(batch, /WindowStyle Hidden/);
  assert.match(batch, /Existing Windows System Assessment score/);
  assert.doesNotMatch(batch, /winsat\.exe\s+(formal|cpu|mem|disk|dwm|d3d)/i);
  assert.doesNotMatch(batch, /ExecutionPolicy Bypass|computername|hostname/i);
});
check('Windows runner rejects malformed one-time tokens', () => {
  assert.throws(() => checkerPackage.buildWindowsBundleBatch('https://api.example.test', 'not-a-token'));
});

const specDisplaySource = await readFile(new URL('../../artifacts/swiftjob-systems/src/lib/systemSpecs.ts', import.meta.url), 'utf8');
const specDisplayModule = await esbuild.transform(specDisplaySource, { loader: 'ts', format: 'esm' });
const specDisplay = await import(`data:text/javascript;base64,${Buffer.from(specDisplayModule.code).toString('base64')}`);
check('Detailed hardware report is rendered as readable candidate/admin rows', () => {
  const entries = specDisplay.formatSystemSpecEntries({
    deviceType: 'Laptop / portable',
    manufacturer: 'Lenovo',
    model: 'ThinkPad T14',
    os: 'Microsoft Windows 11 Pro',
    osVersion: '10.0.26100',
    osBuild: '26100',
    systemArchitecture: '64-bit',
    systemType: 'x64-based PC',
    cpu: 'Example Core Processor',
    cores: 8,
    threads: 16,
    cpuMaxGHz: 4.2,
    ramGB: 32,
    ramAvailableGB: 18.4,
    gpu: 'Example Graphics Adapter / driver 1.2.3 / reported memory 4 GB',
    storage: 'C: 512 GB total, 220 GB free',
    benchmark: 'Existing Windows System Assessment score - base 8.1; CPU 8.5',
    checkedAt: '2026-09-24T12:00:00.000Z',
  });
  const rows = Object.fromEntries(entries.map(({ label, value }) => [label, value]));
  assert.equal(rows.Device, 'Laptop / portable · Lenovo · ThinkPad T14');
  assert.match(rows['Operating system'], /Windows 11 Pro.*build 26100.*64-bit/);
  assert.match(rows['CPU configuration'], /8 cores.*16 logical processors.*4.2 GHz/);
  assert.match(rows.Memory, /32 GB installed.*18.4 GB available/);
  assert.equal(rows.Graphics, 'Example Graphics Adapter / driver 1.2.3 / reported memory 4 GB');
  assert.match(rows['Performance rating'], /System Assessment score/);
  assert.equal(specDisplay.getTechCheckSpecs({ tool: { specs: { cpu: 'Example' } } }).cpu, 'Example');
  assert.equal(specDisplay.getTechCheckSpecs({ tool: { specs: [] } }), null);
});

const source = await readFile(new URL('../../workers-api/src/services/techcheck.ts', import.meta.url), 'utf8');
check('Generated checker source does not bypass execution policy or collect hostnames', () => {
  assert.equal(source.includes('ExecutionPolicy Bypass'), false);
  assert.equal(source.toLowerCase().includes('computername'), false);
  assert.equal(source.toLowerCase().includes('hostname'), false);
  assert.doesNotMatch(source, /function buildWindowsTool\(/);
});

const directMsi = await h.request('/api/tech-check/download/msi/not-a-real-token');
check('MSI is no longer offered as an independent token download', () => assert.equal(directMsi.status, 404));
const invalidPackage = await h.request('/api/tech-check/download/not-a-real-token');
check('Checker package endpoint still rejects invalid or expired tokens', () => assert.equal(invalidPackage.status, 410));

const workerIndexSource = await readFile(new URL('../../workers-api/src/index.ts', import.meta.url), 'utf8');
check('Windows package route verifies the pinned launcher SHA-256 before streaming the bundle', () => {
  const routeStart = workerIndexSource.indexOf('app.get("/api/tech-check/download/:token"');
  const launcherRead = workerIndexSource.indexOf('launcherObject.arrayBuffer()', routeStart);
  const hashCheck = workerIndexSource.indexOf('(await sha256Hex(launcher)) !== CHECKER_LAUNCHER_SHA256', routeStart);
  const bundleStream = workerIndexSource.indexOf('streamWindowsBundle([launcher, batch, msi, footer])', routeStart);
  assert.ok(routeStart >= 0 && launcherRead > routeStart && hashCheck > launcherRead && hashCheck < bundleStream);
});

const launcherSource = await readFile(new URL('../../workers-api/tools/techcheck-launcher/Program.cs', import.meta.url), 'utf8');
check('Windows launcher discloses the collection and requires Continue before starting anything', () => {
  const consent = launcherSource.indexOf('if (!ShowConsentPrompt())');
  const start = launcherSource.indexOf('RunBatch(batchPath, "start"');
  const collect = launcherSource.indexOf('Task<int> collectTask = Task.Run(');
  const launch = launcherSource.indexOf('Process.Start(installerInfo)');
  assert.ok(consent >= 0 && consent < start);
  assert.match(launcherSource, /Text = "Continue"/);
  assert.match(launcherSource, /Text = "Cancel"/);
  assert.match(launcherSource, /computer manufacturer and model/);
  assert.match(launcherSource, /Windows edition, version, build, architecture, and system type/);
  assert.match(launcherSource, /report is sent to SwiftJob and attached to your application only after the installer completes successfully/);
  assert.ok(start < collect && collect < launch);
  assert.match(launcherSource, /scan and installer will not start/i);
});
check('Windows launcher starts the installation window, scans concurrently with visible MSI, and reports only after success', () => {
  const stopwatch = launcherSource.indexOf('Stopwatch installWindow = Stopwatch.StartNew()');
  const start = launcherSource.indexOf('RunBatch(batchPath, "start"');
  const collect = launcherSource.indexOf('Task<int> collectTask = Task.Run(');
  const launch = launcherSource.indexOf('Process.Start(installerInfo)');
  const wait = launcherSource.indexOf('installer.WaitForExit(250)');
  const collectionResult = launcherSource.indexOf('int collectExit = collectTask.GetAwaiter().GetResult()');
  const finalDeadlineCheck = launcherSource.lastIndexOf('if (installWindow.ElapsedMilliseconds >= InstallWindowMilliseconds)');
  const submit = launcherSource.indexOf('RunBatch(batchPath, "submit"');
  assert.ok(stopwatch >= 0 && stopwatch < start);
  assert.ok(start < collect && collect < launch);
  assert.ok(launch < wait && wait < collectionResult && collectionResult < finalDeadlineCheck && finalDeadlineCheck < submit);
  assert.match(launcherSource, /InstallWindowMilliseconds = 10 \* 60 \* 1000/);
  assert.match(launcherSource, /PackageVersion = 2/);
  assert.match(launcherSource, /version != PackageVersion/);
  assert.match(launcherSource, /installerInfo\.WindowStyle = ProcessWindowStyle\.Normal/);
  assert.match(launcherSource, /ProcessStartInfo\(\s*"msiexec\.exe"/);
  assert.match(launcherSource, /installerExit != 0 && installerExit != 3010 && installerExit != 1641/);
  assert.doesNotMatch(launcherSource, /\/(?:qn|quiet|passive)\b/i);
  assert.match(launcherSource, /installer was not stopped/);
  assert.doesNotMatch(launcherSource, /SchedulePackageDeletion|Remove-Item/);
  assert.equal(
    launcherSource.match(/ExpectedMsiSha256\s*=\s*\r?\n\s*"([A-F0-9]+)"/)?.[1],
    checkerPackage.CHECKER_MSI_SHA256,
  );
});
check('Windows launcher provides the report path expected by the generated checker batch', () => {
  assert.match(launcherSource, /EnvironmentVariables\["SWIFTJOB_TECHCHECK_TEMP"\]\s*=\s*tempDirectory/);
  assert.match(launcherSource, /EnvironmentVariables\["SWIFTJOB_TECHCHECK_REPORT"\]\s*=\s*Path\.Combine\(tempDirectory,\s*ReportFileName\)/);
  assert.match(batch, /SWIFTJOB_TECHCHECK_REPORT/);
  assert.match(batch, /WriteAllText\(\$env:SWIFTJOB_TECHCHECK_REPORT/);
  assert.match(batch, /\$path=\$env:SWIFTJOB_TECHCHECK_REPORT/);
});

const preChecksSource = await readFile(new URL('../../artifacts/swiftjob-systems/src/components/PreChecks.tsx', import.meta.url), 'utf8');
check('Candidate page auto-polls, shows specs only after receipt, and has no manual verify/continue control', () => {
  assert.match(preChecksSource, /api\/tech-check\/application-status/);
  assert.match(preChecksSource, /tech-check\/token`, \{\s*method: "POST"/);
  assert.match(preChecksSource, /method: "POST"/);
  assert.match(preChecksSource, /setToolVerified\(true\)/);
  assert.match(preChecksSource, /systemAutoAdvanceRef/);
  assert.match(preChecksSource, /finish the installer within 10 minutes/);
  assert.match(preChecksSource, /secure installation window is active/);
  assert.match(preChecksSource, /Continue\/Cancel notice listing the exact system details collected/);
  assert.match(preChecksSource, /The report is sent to your application only after installation succeeds/);
  assert.doesNotMatch(preChecksSource, /Verify report|45_000|Complete check/);
});

function statusBody(applicationId, email, referenceCode) {
  return { applicationId, email, referenceCode };
}
async function seedCandidate(email, referenceCode) {
  const result = await h.database.query(
    `INSERT INTO applications
      (position, full_name, email, phone, country, city, timezone,
       years_experience, education, english_proficiency, notice_period,
       expected_salary, earliest_start_date, skills, relevant_experience,
       cover_letter, reference_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id`,
    ['Synthetic QA Role', 'Synthetic Candidate', email, '+10000000000', 'Test',
      'Test City', 'UTC', '3 years', 'Synthetic', 'Professional', '2 weeks',
      'Synthetic', '2026-10-01', 'Synthetic', 'Synthetic', 'Synthetic', referenceCode],
  );
  return String(result.rows[0].id);
}
async function requestCandidateToken(applicationId, email, referenceCode) {
  const response = await h.request('/api/tech-check/token', {
    method: 'POST', body: statusBody(applicationId, email, referenceCode),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  const launchTtl = Date.parse(response.data.expiresAt) - Date.now();
  assert.ok(launchTtl > 29 * 60_000 && launchTtl <= 30 * 60_000, `unexpected launch TTL ${launchTtl}`);
  assert.match(response.data.token, /^[a-f0-9]{48}$/);
  return response.data.token;
}
const reportA = {
  os: 'Synthetic Windows 11',
  cpu: 'Synthetic CPU',
  ramGB: 16,
  deviceType: 'Laptop / portable',
};
const candidateA = {
  email: 'tech-check-a@example.test',
  referenceCode: 'SYN-A-0001',
};
const candidateB = {
  email: 'tech-check-b@example.test',
  referenceCode: 'SYN-B-0002',
};
const applicationA = await seedCandidate(candidateA.email, candidateA.referenceCode);
const applicationB = await seedCandidate(candidateB.email, candidateB.referenceCode);
const tokenA = await requestCandidateToken(applicationA, candidateA.email, candidateA.referenceCode);
const tokenB = await requestCandidateToken(applicationB, candidateB.email, candidateB.referenceCode);
let mismatchedLauncherBytesRead = false;
const originalR2Get = h.env.R2_BUCKET.get;
h.env.R2_BUCKET.get = async () => ({
  size: 4,
  customMetadata: { bundleVersion: '1' },
  async arrayBuffer() {
    mismatchedLauncherBytesRead = true;
    return new Uint8Array([0, 1, 2, 3]).buffer;
  },
});
const mismatchedLauncherDownload = await h.request(`/api/tech-check/download/${tokenB}`);
h.env.R2_BUCKET.get = originalR2Get;
check('Bundle endpoint ignores metadata and fails closed when R2 launcher bytes do not match the pinned hash', () => {
  assert.equal(mismatchedLauncherDownload.status, 503);
  assert.equal(mismatchedLauncherBytesRead, true);
  assert.equal(mismatchedLauncherDownload.headers['cache-control'], 'no-store');
});
const wrongOwnerToken = await h.request('/api/tech-check/token', {
  method: 'POST', body: statusBody(applicationA, candidateB.email, candidateB.referenceCode),
});
check('Checker token issuance verifies candidate ownership and returns no-store responses', () => {
  assert.equal(wrongOwnerToken.status, 404);
  assert.equal(wrongOwnerToken.data.token, undefined);
});
const oldGetToken = await h.request(
  `/api/tech-check/token?applicationId=${encodeURIComponent(applicationA)}&email=${encodeURIComponent(candidateA.email)}&referenceCode=${encodeURIComponent(candidateA.referenceCode)}`,
);
check('Token issuance no longer accepts PII-bearing GET URLs', () => assert.equal(oldGetToken.status, 404));

await (async () => {
  const beforeStart = await h.request(`/api/tech-check/status/${tokenA}`);
  check('A token cannot submit hardware before its installer start event', () => {
    assert.equal(beforeStart.status, 200);
    assert.equal(beforeStart.data.startedAt, null);
    assert.equal(beforeStart.data.used, false);
    assert.equal(beforeStart.data.specs, null);
    assert.equal(beforeStart.headers['cache-control'], 'no-store');
  });
  const earlyReport = await h.request(`/api/tech-check/report/${tokenA}`, {
    method: 'POST', body: reportA,
  });
  check('Unstarted report is rejected without storing specifications', () => assert.equal(earlyReport.status, 410));

  const startA = await h.request(`/api/tech-check/start/${tokenA}`, { method: 'POST' });
  check('Starting the checker sets a ten-minute server deadline', () => {
    assert.equal(startA.status, 200);
    assert.ok(startA.data.startedAt);
    const windowMs = Date.parse(startA.data.expiresAt) - Date.parse(startA.data.startedAt);
    assert.ok(windowMs >= 599000 && windowMs <= 600000, `unexpected window length ${windowMs}`);
  });
  const repeatedStart = await h.request(`/api/tech-check/start/${tokenA}`, { method: 'POST' });
  check('Repeated starts are idempotent and cannot extend the deadline', () => {
    assert.equal(repeatedStart.status, 200);
    assert.equal(repeatedStart.data.startedAt, startA.data.startedAt);
    assert.equal(repeatedStart.data.expiresAt, startA.data.expiresAt);
  });

  const activeApplicationStatus = await h.request('/api/tech-check/application-status', {
    method: 'POST', body: statusBody(applicationA, candidateA.email, candidateA.referenceCode),
  });
  check('Application status exposes running state but withholds specs until report receipt', () => {
    assert.equal(activeApplicationStatus.status, 200);
    assert.equal(activeApplicationStatus.data.status, 'in_progress');
    assert.equal(activeApplicationStatus.data.startedAt, startA.data.startedAt);
    assert.equal(activeApplicationStatus.data.specs, null);
    assert.equal(activeApplicationStatus.headers['cache-control'], 'no-store');
  });

  const concurrentIssue = await h.request('/api/tech-check/token', {
    method: 'POST', body: statusBody(applicationA, candidateA.email, candidateA.referenceCode),
  });
  check('A running candidate check cannot be invalidated by issuing a second token', () => {
    assert.equal(concurrentIssue.status, 409);
    assert.equal(concurrentIssue.data.inProgress, true);
  });
  const tokenBStart = await h.request(`/api/tech-check/start/${tokenB}`, { method: 'POST' });
  check('A second candidate can start a separate token at the same time', () => assert.equal(tokenBStart.status, 200));
  const savedConsoleLog = console.log;
  let fullInstallPollRun;
  try {
    console.log = () => {};
    fullInstallPollRun = await Promise.all(Array.from({ length: 180 }, () =>
      h.request(`/api/tech-check/status/${tokenB}`, {
        headers: { 'cf-connecting-ip': '192.0.2.240' },
      }),
    ));
  } finally {
    console.log = savedConsoleLog;
  }
  check('A ten-minute, five-second status-poll run stays under its dedicated limiter', () => {
    assert.ok(fullInstallPollRun.every((response) => response.status === 200));
  });

  const submittedA = await h.request(`/api/tech-check/report/${tokenA}`, {
    method: 'POST', body: reportA,
  });
  check('A successful, started report is stored against its candidate token', () => assert.equal(submittedA.status, 200));
  check('Report receipt responses are explicitly non-cacheable', () => {
    assert.equal(submittedA.headers['cache-control'], 'no-store');
  });
  const completedA = await h.request('/api/tech-check/application-status', {
    method: 'POST', body: statusBody(applicationA, candidateA.email, candidateA.referenceCode),
  });
  const syntheticAdminLogin = await h.request('/api/admin/login', {
    method: 'POST', body: { email: 'admin@example.test', password: 'SyntheticAdminPassword!42' },
  });
  assert.equal(syntheticAdminLogin.status, 200);
  const adminAssessment = await h.request(`/api/admin/applications/${applicationA}/assessment`, {
    token: syntheticAdminLogin.data.token,
  });
  check('Admin application detail can retrieve the completed technical-check specs', () => {
    assert.equal(adminAssessment.status, 200);
    assert.deepEqual(adminAssessment.data.assessment.systemCheck.tool.specs, reportA);
    assert.equal(adminAssessment.headers['cache-control'], 'no-store');
  });
  const stillRunningB = await h.request('/api/tech-check/application-status', {
    method: 'POST', body: statusBody(applicationB, candidateB.email, candidateB.referenceCode),
  });
  check('Concurrent reports remain isolated between applications', () => {
    assert.equal(completedA.data.status, 'completed');
    assert.deepEqual(completedA.data.specs, reportA);
    assert.equal(stillRunningB.data.status, 'in_progress');
    assert.equal(stillRunningB.data.specs, null);
  });
  const wrongOwnerStatus = await h.request('/api/tech-check/application-status', {
    method: 'POST', body: statusBody(applicationA, candidateB.email, candidateB.referenceCode),
  });
  check('Application status rejects mismatched candidate identity without returning another report', () => {
    assert.equal(wrongOwnerStatus.status, 404);
    assert.equal(wrongOwnerStatus.data.specs, undefined);
  });
  const duplicateReport = await h.request(`/api/tech-check/report/${tokenA}`, {
    method: 'POST', body: reportA,
  });
  check('A one-time token rejects duplicate reports', () => assert.equal(duplicateReport.status, 410));

  await h.database.query(
    `UPDATE tech_check_tokens SET expires_at = now() - interval '1 second'
     WHERE token_hash = (SELECT token_hash FROM tech_check_tokens WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1)`,
    [applicationB],
  );
  const lateReport = await h.request(`/api/tech-check/report/${tokenB}`, {
    method: 'POST', body: { ...reportA, cpu: 'Late synthetic CPU' },
  });
  check('A report arriving after the ten-minute deadline is rejected', () => assert.equal(lateReport.status, 410));
  const expiredB = await h.request(`/api/tech-check/status/${tokenB}`);
  check('Expired token status contains no specifications', () => {
    assert.equal(expiredB.data.expired, true);
    assert.equal(expiredB.data.specs, null);
  });

  const candidateC = { email: 'tech-check-c@example.test', referenceCode: 'SYN-C-0003' };
  const applicationC = await seedCandidate(candidateC.email, candidateC.referenceCode);
  const tokenC = await requestCandidateToken(applicationC, candidateC.email, candidateC.referenceCode);
  await h.database.query(
    `UPDATE tech_check_tokens SET expires_at = now() - interval '1 second'
     WHERE application_id = $1`,
    [applicationC],
  );
  const startExpiredC = await h.request(`/api/tech-check/start/${tokenC}`, { method: 'POST' });
  check('A downloaded but unstarted link cannot begin after its 30-minute launch expiry', () => {
    assert.equal(startExpiredC.status, 410);
  });
  const expiredUnstartedStatus = await h.request('/api/tech-check/application-status', {
    method: 'POST', body: statusBody(applicationC, candidateC.email, candidateC.referenceCode),
  });
  check('An expired unstarted link exposes no device report and can be retried with a fresh link', () => {
    assert.equal(expiredUnstartedStatus.data.status, 'not_started');
    assert.equal(expiredUnstartedStatus.data.expired, true);
    assert.equal(expiredUnstartedStatus.data.specs, null);
  });
  const refreshedC = await requestCandidateToken(applicationC, candidateC.email, candidateC.referenceCode);
  check('Candidate can request a new one-time link after an unstarted link expires', () => {
    assert.match(refreshedC, /^[a-f0-9]{48}$/);
  });
})();

console.log(JSON.stringify(checks, null, 2));
await writeFile(new URL('../evidence/techcheck-regression.json', import.meta.url), JSON.stringify({ environment: 'Synthetic executable-bundle fixtures only; no real MSI access, execution, installation, external upload, or production access', results: checks }, null, 2));
await h.close();
if (checks.some(x => x.status === 'FAIL')) process.exitCode = 1;
