import assert from "node:assert/strict";
import { test } from "node:test";
import { initEnv } from "../config";
import { formatContactHtml, formatCustomEmailHtml } from "./email";

initEnv({
  FRONTEND_URL: "https://swiftjob.online",
  HR_EMAIL: "hiring@example.test",
  SUPPORT_EMAIL: "support@example.test",
} as Parameters<typeof initEnv>[0]);

function assertSharedEmailShell(html: string) {
  assert.match(html, /name="color-scheme" content="light dark"/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.match(html, /\[data-ogsc\]/);
  assert.match(html, /email-logo-light-mode/);
  assert.match(html, /email-logo-dark-mode/);
  assert.match(html, /#EEF9F0/);
  assert.match(html, /email-table-label/);
  assert.match(html, /https:\/\/swiftjob\.online\/swiftjob-logo\.png/);
  assert.match(html, /https:\/\/swiftjob\.online\/swiftjob-logo-light\.png/);
}

test("contact notification keeps the shared light/dark email shell and escapes form content", () => {
  const html = formatContactHtml({
    firstName: "<Sam>",
    email: "sam@example.test",
    interest: "Employer & hiring",
    message: "<script>alert('no')</script>\nA second line",
  });

  assertSharedEmailShell(html);
  assert.match(html, /&lt;Sam&gt;/);
  assert.match(html, /Employer &amp; hiring/);
  assert.match(html, /&lt;script&gt;alert\(&#39;no&#39;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(/);
  assert.match(html, /white-space: pre-wrap/);
  assert.match(html, /mailto:sam@example\.test/);
});

test("administrator-authored messages retain the shared shell and escape subject/body", () => {
  const html = formatCustomEmailHtml(
    "Notice <for everyone>",
    "First paragraph\n\nSecond <line>",
  );

  assertSharedEmailShell(html);
  assert.match(html, /Notice &lt;for everyone&gt;/);
  assert.match(html, /Second &lt;line&gt;/);
  assert.doesNotMatch(html, /<line>/);
  assert.match(html, /mailto:support@example\.test/);
});
