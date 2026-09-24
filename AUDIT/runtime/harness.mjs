import { PGlite } from '@electric-sql/pglite';
import { createRequire } from 'node:module';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(path.join(root, 'artifacts/swiftjob-systems/package.json'));
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild');

export async function createHarness() {
  const database = new PGlite();
  globalThis.__auditDatabase = database;
  const migrations = path.join(root, 'workers-api/migrations');
  for (const name of (await readdir(migrations)).filter(x => x.endsWith('.sql')).sort()) {
    await database.exec((await readFile(path.join(migrations, name), 'utf8')).replace(/^\uFEFF/, ''));
  }
  const bundle = path.join(root, 'AUDIT/runtime/generated/worker.mjs');
  await mkdir(path.dirname(bundle), { recursive: true });
  await build({ entryPoints: [path.join(root, 'workers-api/src/index.ts')], outfile: bundle,
    bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: { '@neondatabase/serverless': path.join(root, 'AUDIT/runtime/neon-local.mjs') } });
  const { default: app } = await import(pathToFileURL(bundle).href + '?t=' + Date.now());
  const emails = [];
  const objects = new Map();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url ?? input.href;
    if (url === 'https://api.resend.com/emails' && init?.method === 'POST') {
      const message = JSON.parse(init.body);
      const recipients = [message.to, message.cc, message.bcc].flat().filter(Boolean);
      if (recipients.some(x => !String(x).endsWith('@example.test'))) throw new Error('Non-test email rejected');
      emails.push(message);
      return Response.json({ id: 'audit-email-' + emails.length });
    }
    throw new Error('External network blocked in audit harness: ' + new URL(url).origin);
  };
  const env = { DATABASE_URL: 'postgresql://audit-local-only', RESEND_API_KEY: 're_audit_synthetic',
    EMAIL_FROM: 'SwiftJob <team@swiftjob.online>', HR_EMAIL: 'hr@example.test', SUPPORT_EMAIL: 'support@example.test',
    JWT_SECRET: 'synthetic-audit-secret-at-least-32-characters', ADMIN_EMAIL: 'admin@example.test',
    ADMIN_PASSWORD: 'SyntheticAdminPassword!42', FRONTEND_URL: 'https://swiftjob.example.test',
    R2_BUCKET: {
      async put(key, value, metadata) { objects.set(key, { body: value, httpMetadata: metadata?.httpMetadata }); return {}; },
      async get(key) { return objects.get(key) ?? null; },
      async delete(key) { objects.delete(key); },
    } };
  const pending = [];
  let requestNumber = 0;
  async function request(route, { method = 'GET', body, rawBody, token, cookie, headers: extraHeaders = {} } = {}) {
    const headers = { 'cf-connecting-ip': '192.0.2.' + (++requestNumber % 250 + 1) };
    Object.assign(headers, extraHeaders);
    if (rawBody !== undefined || (body !== undefined && !(body instanceof FormData))) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    if (cookie) headers.Cookie = cookie;
    const response = await app.fetch(new Request('https://swiftjob.example.test' + route, {
      method, headers, body: rawBody ?? (body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body)),
    }), env, { waitUntil(promise) { pending.push(promise); }, passThroughOnException() {} });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, headers: Object.fromEntries(response.headers), data };
  }
  return { database, request, emails, objects, env, app, pending, async close() {
    await Promise.allSettled(pending); globalThis.fetch = originalFetch; await database.close();
  } };
}
