import assert from "node:assert/strict";
import { test } from "node:test";
import { initEnv } from "../config";
import {
  formatApplicationHtml,
  formatConfirmationHtml,
  formatContactHtml,
  formatCustomEmailHtml,
  htmlToText,
  formatMagicLinkHtml,
  formatReferralClickHtml,
  formatReferralInvitationHtml,
  formatStatusUpdateHtml,
  formatTechCheckCompletionHtml,
} from "./email";

initEnv({
  FRONTEND_URL: "https://swiftjob.online",
  HR_EMAIL: "hiring@example.test",
  SUPPORT_EMAIL: "support@example.test",
} as Parameters<typeof initEnv>[0]);

function assertSharedEmailShell(html: string) {
  assert.match(html, /name="color-scheme" content="light dark"/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.match(html, /\[data-ogsc\]/);
  assert.match(html, /class="email-logo-image"/);
  assert.match(html, /#EEF9F0/);
  assert.match(html, /email-table-label/);
  assert.match(html, /https:\/\/swiftjob\.online\/swiftjob-email-lockup\.png\?v=white-lockup-20260924/);
  assert.doesNotMatch(html, /email-logo-(?:light|dark)-mode|swiftjob-logo-light\.png/);
  assert.equal((html.match(/class="email-logo-image"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /undefined|null/);
}

test("application notification is concise, escaped, and links to its own admin record", () => {
  const html = formatApplicationHtml({
    applicationId: "app-123",
    position: "Captioner & Subtitler",
    fullName: "Sam <Candidate>",
  });

  assertSharedEmailShell(html);
  assert.match(html, /Sam &lt;Candidate&gt;/);
  assert.match(html, /Captioner &amp; Subtitler/);
  assert.match(html, /app-123/);
  assert.match(html, /https:\/\/swiftjob\.online\/admin\/applications\?search=app-123/);
});

test("applicant confirmation names the right role and states the real next-step order", () => {
  const html = formatConfirmationHtml({
    fullName: "Sam <Candidate>",
    position: "Captioner / Subtitler",
    applicationId: "app-123",
    referenceCode: "SJ-REF-123",
  });

  assertSharedEmailShell(html);
  assert.match(html, /Hi <strong>Sam &lt;Candidate&gt;<\/strong>/);
  assert.match(html, /Captioner \/ Subtitler/);
  assert.match(html, /2–3 business days/);
  assert.match(html, /required technical check/);
  assert.match(html, /If your application advances/);
  assert.match(html, /SJ-REF-123/);
  assert.match(html, /href="https:\/\/swiftjob\.online\/login"/);
  const text = htmlToText(html);
  assert.match(text, /Open candidate portal \(https:\/\/swiftjob\.online\/login\)/);
  assert.doesNotMatch(text, /<a\b|<style\b/);
});

test("status emails use accurate concise copy for each supported transition", () => {
  const cases = [
    ["Reviewing", "being reviewed by our recruitment team"],
    ["Shortlisted", "moved to the next stage"],
    ["Rejected", "move forward with other candidates"],
    ["Hired", "marked as hired"],
  ] as const;

  for (const [status, expectedCopy] of cases) {
    const html = formatStatusUpdateHtml({
      fullName: "Sam Candidate",
      position: "Captioner / Subtitler",
      status,
      message: `Fallback for ${status}`,
      referenceCode: "SJ-REF-123",
    });
    assertSharedEmailShell(html);
    assert.match(html, /Sam Candidate/);
    assert.match(html, /Captioner \/ Subtitler/);
    assert.match(html, new RegExp(expectedCopy));
    assert.match(html, new RegExp(`email-status-${status.toLowerCase()}`));
    assert.match(html, /SJ-REF-123/);
  }
});

test("magic link mail is short, one-time, expiring, and escapes its personalized greeting", () => {
  const html = formatMagicLinkHtml({
    fullName: "Sam <Candidate>",
    linkUrl: "https://swiftjob.online/auth/verify?token=abc123",
  });

  assertSharedEmailShell(html);
  assert.match(html, /Sam &lt;Candidate&gt;/);
  assert.match(html, /one-time link/);
  assert.match(html, /Expires in 15 minutes/);
  assert.match(html, /https:\/\/swiftjob\.online\/auth\/verify\?token=abc123/);
  assert.match(html, /If you did not request this link, you can ignore this email/);
  assert.match(
    htmlToText(html),
    /Sign in to my portal \(https:\/\/swiftjob\.online\/auth\/verify\?token=abc123\)/,
  );
});

test("referral invitation uses the selected role and escapes authored content", () => {
  const html = formatReferralInvitationHtml({
    fullName: "Sam Candidate",
    referredBy: "Alex Referrer",
    position: "Support Specialist",
    referralUrl: "https://swiftjob.online/referral/SJREF-ABCD1234",
    content: {
      emailGreeting: "Hi Sam <Candidate>,",
      emailBody: "Please review this <role>.",
      emailCtaLabel: "Review role",
      emailClosing: "Thanks & good luck.",
    },
  });

  assertSharedEmailShell(html);
  assert.match(html, /Support Specialist/);
  assert.match(html, /Sam &lt;Candidate&gt;/);
  assert.match(html, /Please review this &lt;role&gt;\./);
  assert.match(html, /Thanks &amp; good luck\./);
  assert.match(html, /href="https:\/\/swiftjob\.online\/referral\/SJREF-ABCD1234"/);
  assert.doesNotMatch(html, /<role>/);
});

test("technical-check notice points to the matching application and excludes report/email details", () => {
  const html = formatTechCheckCompletionHtml({
    applicationId: "app-123",
    referenceCode: "SJ-REF-123",
    fullName: "Sam Candidate",
    position: "Support Specialist",
  });

  assertSharedEmailShell(html);
  assert.match(html, /Sam Candidate/);
  assert.match(html, /Support Specialist/);
  assert.match(html, /SJ-REF-123/);
  assert.match(html, /search=app-123/);
  assert.match(html, /full report is available only in the authorized application record/);
});

test("referral click notice renders the lead, source, device, and timestamp", () => {
  const html = formatReferralClickHtml({
    fullName: "Sam Candidate",
    referredBy: "Alex Referrer",
    position: "Support Specialist",
    referralCode: "SJREF-ABCD1234",
    deviceType: "desktop",
    clickedAt: new Date("2026-09-24T12:30:00.000Z"),
  });

  assertSharedEmailShell(html);
  assert.match(html, /Sam Candidate/);
  assert.match(html, /Alex Referrer/);
  assert.match(html, /Support Specialist/);
  assert.match(html, /PC \/ laptop/);
  assert.match(html, /2026-09-24 12:30/);
});

test("referral click notice does not label an unknown device as a laptop", () => {
  const html = formatReferralClickHtml({
    fullName: "Sam Candidate",
    position: "Support Specialist",
    referralCode: "SJREF-ABCD1234",
    deviceType: "unknown",
    clickedAt: new Date("2026-09-24T12:30:00.000Z"),
  });

  assertSharedEmailShell(html);
  assert.match(html, /Device not identified/);
  assert.doesNotMatch(html, /Laptop confirmed|PC \/ laptop/);
});

test("contact notification escapes form content and supports multiline messages", () => {
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
