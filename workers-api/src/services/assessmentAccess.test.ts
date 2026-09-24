import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessRoleAssessment } from "./assessmentAccess";

test("role assessment requires shortlist and completed technical check", () => {
  assert.equal(canAccessRoleAssessment("New", "completed"), false);
  assert.equal(canAccessRoleAssessment("Reviewing", "completed"), false);
  assert.equal(canAccessRoleAssessment("Shortlisted", "not_started"), false);
  assert.equal(canAccessRoleAssessment("Shortlisted", "in_progress"), false);
  assert.equal(canAccessRoleAssessment("Rejected", "completed"), false);
  assert.equal(canAccessRoleAssessment("Hired", "completed"), false);
  assert.equal(canAccessRoleAssessment("Shortlisted", "completed"), true);
});
