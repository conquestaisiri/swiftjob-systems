import assert from "node:assert/strict";
import test from "node:test";
import {
  applicationQuestionsForJob,
  inferApplicationQuestionTrack,
  normalizeApplicationAnswers,
  normalizeApplicationQuestionOverrides,
} from "./application-questions.ts";
import { ROLE_SPECIFIC_QUESTION_PROMPTS } from "./role-application-prompts.ts";
import { enrichBoilerplateRoleContent } from "./role-content.ts";

test("role families receive focused questions", () => {
  assert.equal(inferApplicationQuestionTrack("back-end-developer", "Back-End Software Developer"), "engineering");
  assert.equal(inferApplicationQuestionTrack("ai-data-annotator-labeler", "AI Data Annotator / Labeler"), "data");
  assert.equal(inferApplicationQuestionTrack("corporate-counsel", "Corporate Counsel / Staff Attorney"), "legal");
  assert.equal(inferApplicationQuestionTrack("telehealth-physician", "Remote Telehealth Physician"), "healthcare");
  assert.equal(inferApplicationQuestionTrack("graphic-designer", "Graphic Designer"), "creative");
  assert.notDeepEqual(
    applicationQuestionsForJob("back-end-developer", "Back-End Software Developer"),
    applicationQuestionsForJob("corporate-counsel", "Corporate Counsel"),
  );
});

test("every currently published fallback role has its own opening application prompt", () => {
  assert.equal(Object.keys(ROLE_SPECIFIC_QUESTION_PROMPTS).length, 95);
  assert.equal(
    new Set(Object.values(ROLE_SPECIFIC_QUESTION_PROMPTS)).size,
    95,
  );
  const backend = applicationQuestionsForJob("backend-developer", "Backend Developer");
  const frontend = applicationQuestionsForJob("frontend-developer", "Frontend Developer");
  assert.notEqual(backend[0]?.prompt, frontend[0]?.prompt);
  assert.match(backend[0]?.id ?? "", /^role-backend-developer$/);
  assert.match(frontend[0]?.id ?? "", /^role-frontend-developer$/);
});

test("custom question overrides are bounded, normalized, and unique", () => {
  assert.deepEqual(
    normalizeApplicationQuestionOverrides([
      { id: "custom-1", prompt: "  Which CRM systems have you used?  ", required: true },
    ]),
    [{ id: "custom-1", prompt: "Which CRM systems have you used?", required: true }],
  );
  assert.throws(
    () => normalizeApplicationQuestionOverrides([
      { id: "same-id", prompt: "First distinct question?" },
      { id: "same-id", prompt: "Second distinct question?" },
    ]),
    /unique identifier/i,
  );
  assert.throws(
    () => normalizeApplicationQuestionOverrides(
      Array.from({ length: 7 }, (_, i) => ({ prompt: `Question number ${i + 1}?` })),
    ),
    /at most 6/i,
  );
});

test("answers are bound to current server prompts, not client-supplied labels", () => {
  const questions = [
    { id: "finance-1", prompt: "Which accounting systems have you used?", required: true },
    { id: "finance-2", prompt: "How do you verify a reconciliation?", required: true },
  ];
  assert.deepEqual(
    normalizeApplicationAnswers(questions, JSON.stringify([
      { id: "finance-1", prompt: "forged client prompt", answer: "QuickBooks and Xero" },
      { id: "finance-2", answer: "I match source totals and investigate variances." },
    ])),
    [
      { id: "finance-1", prompt: questions[0].prompt, answer: "QuickBooks and Xero" },
      { id: "finance-2", prompt: questions[1].prompt, answer: "I match source totals and investigate variances." },
    ],
  );
});

test("required, duplicate, and unknown role answers are rejected", () => {
  const questions = [{ id: "operations-1", prompt: "Describe a workflow you improved.", required: true }];
  assert.throws(() => normalizeApplicationAnswers(questions, "[]"), /Please answer/i);
  assert.throws(
    () => normalizeApplicationAnswers(questions, JSON.stringify([
      { id: "unknown", answer: "answer" },
    ])),
    /do not match/i,
  );
  assert.throws(
    () => normalizeApplicationAnswers(questions, JSON.stringify([
      { id: "operations-1", answer: "one" },
      { id: "operations-1", answer: "two" },
    ])),
    /do not match/i,
  );
});

test("job-description defaults replace only known boilerplate", () => {
  const generic = {
    slug: "back-end-developer",
    title: "Back-End Software Developer",
    summary: "Builds server-side systems and integrations.",
    overview: "Builds server-side systems and integrations. You will own a clear part of the operation, work shoulder-to-shoulder with experienced peers, and have room to grow.",
    responsibilities: [
      "Own defined deliverables and meet weekly targets",
      "Work with engineering, design and ops peers to ship",
      "Write clear docs and communicate asynchronously",
      "Improve your domain over time and share knowledge",
    ],
    requiredQualifications: [
      "3-5 years in a related role with a strong track record",
      "Hands-on command of the relevant tooling and methods",
      "Excellent written English and clear communication",
      "Comfortable working independently in a remote team",
    ],
  };
  const tailored = enrichBoilerplateRoleContent(generic);
  assert.notDeepEqual(tailored.responsibilities, generic.responsibilities);
  assert.notDeepEqual(tailored.requiredQualifications, generic.requiredQualifications);
  assert.match(tailored.overview, /server-side systems and integrations/);
  assert.match(tailored.responsibilities[0], /engineering work/i);

  const authored = {
    ...generic,
    overview: "Admin-authored overview with confirmed project scope.",
    responsibilities: ["Review API changes", "Maintain service runbooks"],
    requiredQualifications: ["Experience with the team's specified runtime"],
  };
  assert.deepEqual(enrichBoilerplateRoleContent(authored), {
    overview: authored.overview,
    responsibilities: authored.responsibilities,
    requiredQualifications: authored.requiredQualifications,
  });
});
