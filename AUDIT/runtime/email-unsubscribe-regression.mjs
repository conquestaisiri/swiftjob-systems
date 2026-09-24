import assert from 'node:assert/strict';
import { createHarness } from './harness.mjs';

const h = await createHarness();
const checks = [];
const recipient = 'outreach@example.test';
const adminPassword = h.env.ADMIN_PASSWORD;

async function check(name, run) {
  await run();
  checks.push({ name, status: 'PASS' });
}

try {
  const login = await h.request('/api/admin/login', {
    method: 'POST',
    body: { email: h.env.ADMIN_EMAIL, password: adminPassword },
  });
  assert.equal(login.status, 200);
  const adminToken = login.data.token;

  const sendOutreach = () => h.request('/api/admin/mail/send', {
    method: 'POST',
    token: adminToken,
    body: {
      recipients: [{ email: recipient }],
      mode: 'custom',
      subject: 'Synthetic outreach test',
      body: 'This message exists only inside the local mail test harness.',
    },
  });

  await check('outreach uses the canonical sender, tags, visible opt-out, and RFC 8058 headers', async () => {
    const result = await sendOutreach();
    assert.equal(result.status, 200);
    assert.equal(result.data.sent, 1);
    const message = h.emails.at(-1);
    assert.equal(message.from, 'SwiftJob <team@swiftjob.online>');
    assert.equal(message.tags?.[0]?.value, 'admin_outreach');
    assert.match(message.headers?.['List-Unsubscribe'] ?? '', /^<https:\/\/swiftjob\.online\/api\/email\/unsubscribe\?token=/);
    assert.equal(message.headers?.['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.match(message.html, /Unsubscribe from outreach/);
    assert.match(message.html, /https:\/\/swiftjob\.online\/api\/email\/unsubscribe\?token=/);
  });

  const message = h.emails.at(-1);
  const unsubscribeHeader = message.headers['List-Unsubscribe'];
  const unsubscribeUrl = unsubscribeHeader.slice(1, -1);
  const token = new URL(unsubscribeUrl).searchParams.get('token');
  assert.ok(token);

  await check('a scanner GET validates the preference page but does not unsubscribe the recipient', async () => {
    const page = await h.request(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`);
    assert.equal(page.status, 200);
    assert.equal(page.headers['referrer-policy'], 'no-referrer');
    assert.match(page.data, /Manage SwiftJob email preferences/);
    assert.equal((await h.database.query('SELECT count(*)::int AS n FROM email_unsubscriptions')).rows[0].n, 0);
    const sentBefore = h.emails.length;
    assert.equal((await sendOutreach()).data.sent, 1);
    assert.equal(h.emails.length, sentBefore + 1);
  });

  await check('RFC 8058 one-click POST persists an opt-out and blocks later outreach', async () => {
    const response = await h.request(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      rawBody: 'List-Unsubscribe=One-Click',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    assert.equal(response.status, 200);
    const stored = await h.database.query('SELECT email, source FROM email_unsubscriptions');
    assert.deepEqual(stored.rows, [{ email: recipient, source: 'one_click' }]);

    const sentBefore = h.emails.length;
    const blocked = await sendOutreach();
    assert.equal(blocked.status, 200);
    assert.equal(blocked.data.sent, 0);
    assert.match(blocked.data.failed[0].error, /unsubscribed/);
    assert.equal(h.emails.length, sentBefore);
  });

  await check('transactional sign-in mail remains available after outreach opt-out', async () => {
    const response = await h.request('/api/auth/magic-link', {
      method: 'POST',
      body: { email: recipient },
    });
    assert.equal(response.status, 200);
    assert.equal(h.emails.at(-1).tags?.[0]?.value, 'candidate_sign_in');
  });

  console.log(JSON.stringify(checks, null, 2));
} finally {
  await h.close();
}
