import { createHarness } from './harness.mjs';
import { writeFile } from 'node:fs/promises';
const h = await createHarness();
const evidence = { environment: 'Local PGlite + original Worker; synthetic records and email sink; no production writes', checks: [] };
try {
  const contact = await h.request('/api/contact', { method: 'POST', body: {
    firstName: 'Audit', email: 'candidate@example.test', interest: 'Finding work', message: 'Synthetic audit contact message.',
  } });
  evidence.checks.push({ name: 'Valid contact submission', expected: 201, actual: contact.status, response: contact.data });
  const form = new FormData();
  const fields = { position: 'Nonexistent audit vacancy', fullName: 'Synthetic Candidate', email: 'candidate@example.test',
    phone: '+2340000000000', country: 'Nigeria', city: 'Lagos', timezone: 'Africa/Lagos', yearsExperience: '3',
    education: 'Bachelors', englishProficiency: 'Fluent', noticePeriod: '2 weeks', expectedSalary: '1000',
    earliestStartDate: '2026-10-01', skills: 'Synthetic testing', relevantExperience: 'Synthetic testing experience', coverLetter: 'Synthetic application' };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const application = await h.request('/api/applications', { method: 'POST', body: form });
  evidence.checks.push({ name: 'Unknown job and missing required CV', expected: 400, actual: application.status });
  const register = await h.request('/api/auth/register', { method: 'POST', body: {
    email: fields.email, password: 'SyntheticPassword123!', applicationId: application.data.applicationId,
  } });
  evidence.checks.push({ name: 'Unauthenticated password registration', expected: 401, actual: register.status });
  const overwrite = await h.request('/api/auth/register', { method: 'POST', body: {
    email: fields.email, password: 'ReplacementPassword123!', applicationId: application.data.applicationId,
  } });
  evidence.checks.push({ name: 'Unauthenticated password overwrite', expected: 401, actual: overwrite.status });
  const login = await h.request('/api/auth/login-password', { method: 'POST', body: {
    email: fields.email, password: 'ReplacementPassword123!',
  } });
  const portal = await h.request('/api/candidate/applications', { token: login.data.token });
  evidence.checks.push({ name: 'Password session accepted by portal', loginStatus: login.status, expected: 200, actual: portal.status, response: portal.data });
  evidence.checks.push({ name: 'Candidate password cookie uses portal cookie name', expected: true,
    actual: (login.headers['set-cookie'] ?? '').startsWith('swiftjob_session=') });
  await writeFile(new URL('../evidence/workflow-baseline.json', import.meta.url), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally { await h.close(); }
