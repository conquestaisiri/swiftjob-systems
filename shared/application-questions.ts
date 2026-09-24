import { ROLE_SPECIFIC_QUESTION_PROMPTS } from "./role-application-prompts.ts";

export interface ApplicationQuestion {
  id: string;
  prompt: string;
  required: boolean;
}

export interface ApplicationAnswer {
  id: string;
  prompt: string;
  answer: string;
}

export type ApplicationQuestionTrack =
  | "engineering"
  | "data"
  | "customer-support"
  | "sales"
  | "finance"
  | "healthcare"
  | "legal"
  | "creative"
  | "content"
  | "marketing"
  | "education"
  | "people"
  | "operations"
  | "product"
  | "leadership"
  | "general";

const QUESTION_SETS: Record<ApplicationQuestionTrack, string[]> = {
  engineering: [
    "Which languages, platforms, or technical tools have you used most in work relevant to this role?",
    "Describe a recent technical problem you diagnosed or solution you delivered. What was your contribution?",
    "How do you test, document, and hand over technical work so another teammate can maintain it?",
  ],
  data: [
    "Which data, research, annotation, or quality-control tools have you used that are relevant to this role?",
    "Describe how you keep detailed work accurate when reviewing or processing a large volume of records or tasks.",
    "Give an example of a finding, discrepancy, or quality issue you identified and how you handled it.",
  ],
  "customer-support": [
    "Which customer-support channels and case-management tools have you used, and what types of issues did you handle?",
    "Describe a difficult customer interaction and the steps you took to resolve it professionally.",
    "What working hours or time-zone overlap can you reliably support for this role?",
  ],
  sales: [
    "Which sales, prospecting, or CRM tools have you used, and what part of the sales process did you own?",
    "Describe a measurable outreach or conversion result you achieved and how you contributed to it.",
    "How do you organize follow-ups while keeping prospect communication relevant and respectful?",
  ],
  finance: [
    "Which accounting, finance, reporting, or spreadsheet systems have you used in a professional setting?",
    "Describe a financial record, reconciliation, or analysis you prepared and the checks you used to verify it.",
    "What controls do you follow when handling confidential financial information?",
  ],
  healthcare: [
    "What current professional licence, registration, or healthcare credential is relevant to this role, and where is it valid?",
    "Which clinical, research, coding, or telehealth systems have you used that are relevant to this position?",
    "How do you protect patient confidentiality and maintain accurate records in your work?",
  ],
  legal: [
    "In which jurisdictions are you qualified to practise, and what is the status of your relevant licence or bar admission?",
    "Describe the types of agreements, legal matters, or compliance work most relevant to this position.",
    "How do you track changes, deadlines, and confidentiality requirements across active matters?",
  ],
  creative: [
    "Please share a portfolio or work sample most relevant to this role and explain your contribution to it.",
    "Which design, editing, or production tools do you use most confidently?",
    "Describe how you turn a brief and feedback into a polished deliverable while meeting a deadline.",
  ],
  content: [
    "Please share a writing, editing, or publishing sample most relevant to this role and explain your contribution.",
    "Which editorial, content-management, transcription, or publishing tools have you used?",
    "How do you check accuracy, tone, accessibility, and consistency before delivering content?",
  ],
  marketing: [
    "Which marketing channels, analytics platforms, and campaign tools have you used directly?",
    "Describe a campaign or growth improvement you contributed to and the result you measured.",
    "How do you adapt a message for different audiences while keeping the brand consistent?",
  ],
  education: [
    "Which subjects, learner groups, or instructional formats are you best prepared to support?",
    "Describe a lesson, learning resource, or tutoring approach you used to help someone understand a difficult topic.",
    "Which learning platforms or assessment tools have you used?",
  ],
  people: [
    "Which applicant-tracking, HR, scheduling, or people-operations systems have you used?",
    "Describe how you coordinate a confidential, deadline-sensitive people process while keeping records accurate.",
    "How do you keep candidates or colleagues informed when several people and steps are involved?",
  ],
  operations: [
    "Which administrative, project, inventory, or workflow tools have you used that are relevant to this role?",
    "Describe a process you organized or improved. How did you keep the work accurate and on schedule?",
    "How do you prioritize urgent requests when several tasks have competing deadlines?",
  ],
  product: [
    "Which product, analytics, or agile-planning tools have you used, and how did they support your work?",
    "Describe a decision you made using customer, operational, or product evidence. What changed as a result?",
    "How do you keep stakeholders aligned when requirements or priorities change?",
  ],
  leadership: [
    "What teams, functions, or outcomes have you led that are most relevant to this position?",
    "Describe a measurable improvement you led and how you aligned people around the change.",
    "How do you set clear expectations and maintain accountability across a distributed team?",
  ],
  general: [
    "What experience or work sample best demonstrates your readiness for this role?",
    "Describe how you organize your work to meet quality expectations and deadlines.",
  ],
};

const TRACK_RULES: Array<[ApplicationQuestionTrack, RegExp]> = [
  ["healthcare", /physician|psychiatrist|teleradiolog|radiolog|clinical-research|medical-cod|telehealth/],
  ["legal", /counsel|attorney|lawyer|legal/],
  ["leadership", /\bchief\b|\bceo\b|\bcto\b|director|head-of|fractional-cmo|executive-lead/],
  ["engineering", /developer|engineer|architect|devops|database-administrator|systems-administrator|penetration-tester|ethical-hacker|cybersecurity|qa-(?:software-)?(?:tester|engineer)|salesforce-administrator|it-support/],
  ["finance", /actuar|financial-analyst|quant|bookkeep|billing-specialist|payroll|accountant/],
  ["sales", /sales|lead-generation|appointment-setter|telemarketer|business-development/],
  ["customer-support", /customer|support|receptionist|moderator|success-representative/],
  ["education", /tutor|instructional-designer|teacher|learning-and-development/],
  ["people", /human-resources|hr-assistant|recruit|talent-acquisition/],
  ["product", /product-manager|business-analyst|scrum-master|agile-coach/],
  ["creative", /graphic-designer|ui-ux|video-editor|visual-designer|multimedia/],
  ["content", /writer|proofreader|editor|captioner|subtitler|transcri|grant-writer|content-moderator/],
  ["data", /data|annotat|labeler|evaluator|survey|micro-task|research-assistant|operations-analyst/],
  ["finance", /finance|bookkeeper|billing|payroll/],
  ["marketing", /marketing|seo|paid-ads|ppc|community-manager|growth/],
  ["operations", /virtual-assistant|administrative|operations|coordinator|inventory|order-processing|ecommerce|e-commerce|dropshipping/],
];

// Normalize one-off roles from the admin editor and older listings the same
// way in the public application, API validation, and admin review.
export function inferApplicationQuestionTrack(
  slug: string,
  title: string,
): ApplicationQuestionTrack {
  const haystack = `${slug} ${title}`.toLowerCase();
  for (const [track, rule] of TRACK_RULES) {
    if (rule.test(haystack)) return track;
  }
  return "general";
}

export function defaultApplicationQuestions(
  slug: string,
  title: string,
): ApplicationQuestion[] {
  const track = inferApplicationQuestionTrack(slug, title);
  const rolePrompt = ROLE_SPECIFIC_QUESTION_PROMPTS[slug.toLowerCase()];
  const prompts = rolePrompt
    ? [rolePrompt, ...QUESTION_SETS[track].slice(1)]
    : QUESTION_SETS[track];
  const roleId = slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return prompts.map((prompt, index) => ({
    id: rolePrompt && index === 0 ? `role-${roleId}` : `${track}-${index + 1}`,
    prompt,
    required: true,
  }));
}

export function normalizeApplicationQuestionOverrides(
  value: unknown,
): ApplicationQuestion[] {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) {
    throw new Error("Role-specific questions must be provided as a list.");
  }
  if (value.length > 6) {
    throw new Error("A role can have at most 6 additional application questions.");
  }

  const seen = new Set<string>();
  const seenIds = new Set<string>();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw new Error(`Role question ${index + 1} is invalid.`);
    }
    const item = raw as Record<string, unknown>;
    const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
    if (prompt.length < 8 || prompt.length > 240) {
      throw new Error(`Role question ${index + 1} must be 8–240 characters.`);
    }
    const normalized = prompt.toLocaleLowerCase();
    if (seen.has(normalized)) {
      throw new Error("Role-specific questions cannot be duplicated.");
    }
    seen.add(normalized);
    const suppliedId = typeof item.id === "string" ? item.id.trim() : "";
    const id = /^[a-z0-9][a-z0-9_-]{1,79}$/.test(suppliedId)
      ? suppliedId
      : `custom-${index + 1}`;
    if (seenIds.has(id)) {
      throw new Error("Each role-specific question must have a unique identifier.");
    }
    seenIds.add(id);
    return {
      id,
      prompt,
      required: item.required !== false,
    };
  });
}

export function applicationQuestionsForJob(
  slug: string,
  title: string,
  overrides?: unknown,
): ApplicationQuestion[] {
  const custom = normalizeApplicationQuestionOverrides(overrides);
  return custom.length > 0 ? custom : defaultApplicationQuestions(slug, title);
}

export function normalizeApplicationAnswers(
  questions: ApplicationQuestion[],
  serialized: string,
): ApplicationAnswer[] {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("Please review and answer the role-specific questions.");
  }
  if (!Array.isArray(value)) {
    throw new Error("The role-specific answers could not be verified.");
  }

  const byId = new Map<string, string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      throw new Error("The role-specific answers could not be verified.");
    }
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.answer !== "string") {
      throw new Error("The role-specific answers could not be verified.");
    }
    if (!questions.some((question) => question.id === item.id) || byId.has(item.id)) {
      throw new Error("The role-specific answers do not match this position.");
    }
    const answer = item.answer.trim();
    if (answer.length > 5000) {
      throw new Error("Each role-specific answer must be 5,000 characters or fewer.");
    }
    byId.set(item.id, answer);
  }

  const answers: ApplicationAnswer[] = [];
  for (const question of questions) {
    const answer = byId.get(question.id) ?? "";
    if (question.required && !answer) {
      throw new Error(`Please answer: ${question.prompt}`);
    }
    if (answer) answers.push({ id: question.id, prompt: question.prompt, answer });
  }
  return answers;
}
