import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createHarness } from './harness.mjs';

const h = await createHarness();
const results = [];
let referralId;
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error.message });
    throw error;
  }
}

const job = {
  slug: 'referral-audit-role',
  title: 'Referral Audit Role',
  department: 'Operations',
  employmentType: 'Full-time',
  workArrangement: 'Remote',
  experienceLevel: 'Mid-Level',
  experience: '2+ years',
  compensation: '$2,000/month',
  postedDate: '2026-09-01',
  summary: 'Synthetic referral audit vacancy',
  overview: 'Synthetic referral audit vacancy for local testing.',
  responsibilities: ['Support candidates'],
  requiredQualifications: ['Clear communication'],
  preferredQualifications: ['Remote experience'],
  skills: ['Operations'],
  softwareTools: ['Email'],
  benefits: ['Training'],
  workingHours: 'Business hours',
  hiringProcess: ['Review'],
  isActive: true,
  referralRewardCents: 7500,
};

async function seedJob() {
  const columns = {
    slug: job.slug,
    title: job.title,
    department: job.department,
    employment_type: job.employmentType,
    work_arrangement: job.workArrangement,
    experience_level: job.experienceLevel,
    experience: job.experience,
    compensation: job.compensation,
    posted_date: job.postedDate,
    summary: job.summary,
    overview: job.overview,
    responsibilities: job.responsibilities,
    required_qualifications: job.requiredQualifications,
    preferred_qualifications: job.preferredQualifications,
    skills: job.skills,
    software_tools: job.softwareTools,
    benefits: job.benefits,
    working_hours: job.workingHours,
    hiring_process: job.hiringProcess,
    is_active: job.isActive,
    referral_reward_cents: job.referralRewardCents,
  };
  await h.database.query(
    `INSERT INTO jobs (${Object.keys(columns).map((key) => '"' + key + '"').join(',')}) VALUES (${Object.keys(columns).map((_, index) => '$' + (index + 1)).join(',')})`,
    Object.values(columns),
  );
}

function form(email, overrides = {}) {
  const fields = {
    jobSlug: job.slug,
    position: job.title,
    fullName: 'Referred Synthetic Applicant',
    email,
    phone: '+2340000000000',
    country: 'Nigeria',
    city: 'Lagos',
    timezone: 'Africa/Lagos',
    yearsExperience: '3–5 years',
    education: "Bachelor's degree",
    englishProficiency: 'Professional working proficiency (B2)',
    noticePeriod: '2 weeks',
    expectedSalary: '$2,000/month',
    earliestStartDate: '2026-10-01',
    skills: 'Operations',
    relevantExperience: 'Synthetic referral application experience',
    coverLetter: 'Synthetic referral cover letter',
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  data.set('resume', new File(['%PDF-1.7\nsynthetic'], 'resume.pdf', { type: 'application/pdf' }));
  return data;
}

try {
  await seedJob();
  await h.database.query(
    `INSERT INTO candidate_referral_links (owner_email, code, job_slug) VALUES ($1, $2, $3)`,
    ['referrer@example.test', 'SJREF-TEST1234', job.slug],
  );
  await h.database.query(
    `INSERT INTO candidate_referral_links (owner_email, code) VALUES ($1, $2)`,
    ['referrer@example.test', 'SJREF-GENERAL1'],
  );

  await check('Application with a valid role referral creates one attributed reward', async () => {
    const response = await h.request('/api/applications', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'referral-audit-key-2026' },
      body: form('referred@example.test', { referralCode: 'sjref-test1234' }),
    });
    assert.equal(response.status, 201);
    const rows = (await h.database.query(
      'SELECT id, owner_email, link_code, referred_email, job_slug, status, reward_cents, payout_status FROM candidate_referrals',
    )).rows;
    assert.equal(rows.length, 1);
    referralId = rows[0].id;
    delete rows[0].id;
    assert.deepEqual(rows[0], {
      owner_email: 'referrer@example.test',
      link_code: 'SJREF-TEST1234',
      referred_email: 'referred@example.test',
      job_slug: job.slug,
      status: 'applied',
      reward_cents: 7500,
      payout_status: 'pending',
    });
  });

  await check('Repeated application does not create a second referral reward', async () => {
    const response = await h.request('/api/applications', {
      method: 'POST',
      body: form('referred@example.test', { referralCode: 'SJREF-TEST1234' }),
    });
    assert.equal(response.status, 201);
    assert.equal((await h.database.query('SELECT count(*)::int AS count FROM candidate_referrals')).rows[0].count, 1);
  });

  await check('Self-referral is ignored', async () => {
    const response = await h.request('/api/applications', {
      method: 'POST',
      body: form('referrer@example.test', { referralCode: 'SJREF-TEST1234' }),
    });
    assert.equal(response.status, 201);
    assert.equal((await h.database.query('SELECT count(*)::int AS count FROM candidate_referrals')).rows[0].count, 1);
  });

  await check('Admin can verify a hire and then mark the reward paid', async () => {
    const login = await h.request('/api/admin/login', {
      method: 'POST',
      body: { email: h.env.ADMIN_EMAIL, password: h.env.ADMIN_PASSWORD },
    });
    assert.equal(login.status, 200);
    const token = login.data.token;
    const list = await h.request('/api/admin/candidate-referrals', { token });
    assert.equal(list.status, 200);
    assert.equal(list.data.referrals[0].id, referralId);

    const earlyPayout = await h.request(`/api/admin/candidate-referrals/${referralId}`, {
      method: 'PATCH',
      token,
      body: { payoutStatus: 'paid' },
    });
    assert.equal(earlyPayout.status, 400);

    const hired = await h.request(`/api/admin/candidate-referrals/${referralId}`, {
      method: 'PATCH',
      token,
      body: { status: 'hired' },
    });
    assert.equal(hired.status, 200);
    assert.equal(hired.data.referral.status, 'hired');

    const paid = await h.request(`/api/admin/candidate-referrals/${referralId}`, {
      method: 'PATCH',
      token,
      body: { payoutStatus: 'paid' },
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.data.referral.payoutStatus, 'paid');
  });

  await check('General referral links expose a range instead of a misleading fixed reward', async () => {
    const response = await h.request('/api/candidate-referrals/SJREF-GENERAL1');
    assert.equal(response.status, 200);
    assert.equal(response.data.rewardCents, null);
    assert.deepEqual(response.data.rewardRangeCents, { min: 4000, max: 10000 });
  });
} finally {
  await writeFile(
    new URL('../evidence/referral-regression.json', import.meta.url),
    JSON.stringify({ environment: 'Local PGlite + actual Worker; synthetic email sink; no production access', results }, null, 2),
  );
  await h.close();
  console.log(JSON.stringify(results, null, 2));
}
