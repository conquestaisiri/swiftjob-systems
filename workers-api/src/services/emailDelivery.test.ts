import assert from "node:assert/strict";
import { test } from "node:test";

import { verifyResendWebhook } from "./emailDelivery";

const encoder = new TextEncoder();

function encodeBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}

async function createSignature(payload: string, timestamp: number) {
  const secretBytes = encoder.encode("swiftjob-webhook-test-secret");
  const secret = `whsec_${encodeBase64(secretBytes)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const eventId = "evt_test_delivery_123";
  const signedContent = encoder.encode(`${eventId}.${timestamp}.${payload}`);
  const signature = encodeBase64(new Uint8Array(await crypto.subtle.sign("HMAC", key, signedContent)));
  return {
    secret,
    headers: {
      id: eventId,
      timestamp: String(timestamp),
      signature: `v1,${signature}`,
    },
  };
}

test("accepts a correctly signed, fresh Resend event and normalizes recipient addresses", async () => {
  const timestamp = 1_800_000_000;
  const payload = JSON.stringify({
    type: "email.bounced",
    created_at: new Date(timestamp * 1000).toISOString(),
    data: {
      email_id: "resend-email-123",
      to: [" Candidate@Example.com "],
      bounce: { type: "Permanent" },
    },
  });
  const signed = await createSignature(payload, timestamp);

  const event = await verifyResendWebhook(payload, signed.headers, signed.secret, timestamp);

  assert.equal(event?.type, "email.bounced");
  assert.equal(event?.eventId, "evt_test_delivery_123");
  assert.deepEqual(event?.recipients, ["candidate@example.com"]);
  assert.equal(event?.permanentBounce, true);
});

test("rejects modified payloads and stale signatures", async () => {
  const timestamp = 1_800_000_000;
  const payload = JSON.stringify({
    type: "email.delivered",
    data: { email_id: "resend-email-456", to: ["candidate@example.com"] },
  });
  const signed = await createSignature(payload, timestamp);

  assert.equal(
    await verifyResendWebhook(`${payload} `, signed.headers, signed.secret, timestamp),
    null,
  );
  assert.equal(
    await verifyResendWebhook(payload, signed.headers, signed.secret, timestamp + 301),
    null,
  );
});
