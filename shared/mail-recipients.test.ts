import assert from "node:assert/strict";
import test from "node:test";
import { parseMailRecipients } from "../artifacts/swiftjob-systems/src/lib/mailRecipients.ts";

test("parses plain addresses and named recipients case-insensitively", () => {
  const parsed = parseMailRecipients(
    'JANE@Example.com\n"John Doe" <john@example.com>',
  );

  assert.deepEqual(parsed.recipients, [
    { email: "jane@example.com" },
    { email: "john@example.com", fullName: "John Doe" },
  ]);
  assert.deepEqual(parsed.invalidLines, []);
  assert.deepEqual(parsed.duplicateEmails, []);
});

test("reports malformed entries and deduplicates without hiding the duplicate", () => {
  const parsed = parseMailRecipients(
    "person@example.com\nnot-an-address\nPERSON@example.com\nOther Name other@example.org",
  );

  assert.equal(parsed.recipients.length, 2);
  assert.deepEqual(parsed.invalidLines, ["not-an-address"]);
  assert.deepEqual(parsed.duplicateEmails, ["person@example.com"]);
});

test("ignores empty lines and rejects invalid display-name addresses", () => {
  const parsed = parseMailRecipients("\nJane <not-an-email>\n\n");
  assert.deepEqual(parsed.recipients, []);
  assert.deepEqual(parsed.invalidLines, ["Jane <not-an-email>"]);
});
