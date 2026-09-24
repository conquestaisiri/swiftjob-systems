import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHarness } from './harness.mjs';

const h = await createHarness();
const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); }
}

const source = await readFile(new URL('../../workers-api/src/services/techcheck.ts', import.meta.url), 'utf8');
check('Generated checkers do not bypass execution policy or collect hostname', () => {
  assert.equal(source.includes('ExecutionPolicy Bypass'), false);
  assert.equal(source.toLowerCase().includes('computername'), false);
  assert.equal(source.toLowerCase().includes('hostname'), false);
});
const windowsMsi = await h.request('/api/tech-check/download/msi/not-a-real-token');
check('Windows MSI downloads stay paused during the security review', () => assert.equal(windowsMsi.status, 503));

console.log(JSON.stringify(checks, null, 2));
await writeFile(new URL('../evidence/techcheck-regression.json', import.meta.url), JSON.stringify({ environment: 'Source assertions + Local PGlite Worker; no production access', results: checks }, null, 2));
await h.close();
if (checks.some(x => x.status === 'FAIL')) process.exitCode = 1;
