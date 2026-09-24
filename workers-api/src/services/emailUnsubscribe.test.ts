import assert from "node:assert/strict";
import { test } from "node:test";
import { initEnv } from "../config";
import {
  createEmailUnsubscribeToken,
  emailUnsubscribeService,
  verifyEmailUnsubscribeToken,
} from "./emailUnsubscribe";

initEnv({
  JWT_SECRET: "test-only-jwt-secret-with-sufficient-length",
  FRONTEND_URL: "https://swiftjob.online",
} as Parameters<typeof initEnv>[0]);

test("unsubscribe tokens encrypt and normalize the recipient address", async () => {
  const token = await createEmailUnsubscribeToken("  Person@Example.com ");
  assert.doesNotMatch(token, /person|example/i);
  assert.equal(await verifyEmailUnsubscribeToken(token), "person@example.com");
  assert.equal(await verifyEmailUnsubscribeToken("not-a-token"), null);
});

test("unsubscribe token authentication rejects tampering", async () => {
  const token = await createEmailUnsubscribeToken("person@example.com");
  const index = token.length - 2;
  const replacement = token[index] === "A" ? "B" : "A";
  const tampered = `${token.slice(0, index)}${replacement}${token.slice(index + 1)}`;
  assert.equal(await verifyEmailUnsubscribeToken(tampered), null);
});

test("unsubscribe links always use the canonical .online domain", async () => {
  initEnv({
    JWT_SECRET: "test-only-jwt-secret-with-sufficient-length",
    FRONTEND_URL: "https://another-brand.example",
  } as Parameters<typeof initEnv>[0]);
  const link = await emailUnsubscribeService.createLink("person@example.com");
  assert.equal(new URL(link).origin, "https://swiftjob.online");
  assert.match(link, /\/api\/email\/unsubscribe\?token=/);
  assert.doesNotMatch(link, /person@example\.com/i);
});

test("invalid recipient addresses cannot receive unsubscribe tokens", async () => {
  await assert.rejects(
    createEmailUnsubscribeToken("not-an-email"),
    /valid email address/,
  );
});
