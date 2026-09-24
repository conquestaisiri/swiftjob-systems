import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesAdminLoginIdentifier, matchesAdminPassword } from "./adminLogin";

test("admin login accepts configured email or username, ignoring case and surrounding spaces", () => {
  assert.equal(
    matchesAdminLoginIdentifier(" admin@swiftjob.online ", "admin@swiftjob.online", "conquest"),
    true,
  );
  assert.equal(
    matchesAdminLoginIdentifier("Conquest", "admin@swiftjob.online", "conquest"),
    true,
  );
});

test("admin login rejects identifiers that are not configured", () => {
  assert.equal(
    matchesAdminLoginIdentifier("unknown", "admin@swiftjob.online", "conquest"),
    false,
  );
  assert.equal(
    matchesAdminLoginIdentifier("", "admin@swiftjob.online", "conquest"),
    false,
  );
});

test("admin password comparison accepts any letter casing, but still requires the exact characters", () => {
  assert.equal(matchesAdminPassword("Daddy_2003", "Daddy_2003"), true);
  assert.equal(matchesAdminPassword("daddy_2003", "Daddy_2003"), true);
  assert.equal(matchesAdminPassword("DADDY_2003", "Daddy_2003"), true);
  assert.equal(matchesAdminPassword("Daddy2003", "Daddy_2003"), false);
});
