import {
  inferApplicationQuestionTrack,
  type ApplicationQuestionTrack,
} from "./application-questions.ts";

export interface RoleContentInput {
  slug: string;
  title: string;
  summary: string;
  overview: string;
  responsibilities: string[];
  requiredQualifications: string[];
}

export interface RoleContentOutput {
  overview: string;
  responsibilities: string[];
  requiredQualifications: string[];
}

interface RoleContentProfile {
  overview: string;
  responsibilities: string[];
  qualifications: string[];
}

const PROFILES: Record<ApplicationQuestionTrack, RoleContentProfile> = {
  engineering: {
    overview: "The work typically includes building, configuring, testing, or maintaining the systems named in the project brief. Changes should be reviewed, documented, and handed over in a form the team can support.",
    responsibilities: [
      "Deliver the engineering work described in the role brief, from implementation or configuration through verification.",
      "Investigate defects and operational issues, explain the likely cause, and document the resolution or remaining risk.",
      "Use appropriate tests, reviews, and security or reliability checks before handing changes to the team.",
      "Record technical decisions and communicate dependencies, blockers, and delivery progress to collaborators.",
    ],
    qualifications: [
      "Practical knowledge of the technical area named in the position summary.",
      "Ability to explain a relevant project, the decisions you made, and the outcome you delivered.",
      "Careful approach to testing, documentation, access control, and handling production changes.",
      "Able to collaborate asynchronously and raise delivery risks early.",
    ],
  },
  data: {
    overview: "The work centers on processing, reviewing, interpreting, or validating data against agreed definitions. Consistent decisions, traceable corrections, and early escalation of ambiguous cases matter as much as throughput.",
    responsibilities: [
      "Complete the role's data, annotation, research, evaluation, or verification tasks using the supplied criteria.",
      "Check records and outputs for omissions, inconsistencies, duplicates, and other quality issues before submission.",
      "Apply labeling or reporting rules consistently and flag examples that cannot be classified confidently.",
      "Maintain clear work records and protect confidential or restricted information throughout processing.",
    ],
    qualifications: [
      "Strong attention to detail and willingness to follow written definitions consistently.",
      "Able to explain how you check work for accuracy and resolve uncertain cases.",
      "Comfortable using the spreadsheet, research, annotation, or workflow tools required by the role.",
      "Reliable written communication and care with confidential information.",
    ],
  },
  "customer-support": {
    overview: "The role helps customers or users through the channels and service standards set by the team. Clear responses, accurate case notes, appropriate escalation, and respectful handling of personal information are central to the work.",
    responsibilities: [
      "Respond to customer questions through the channels assigned to the role and keep ownership clear until hand-off or resolution.",
      "Clarify the issue, provide accurate guidance from approved resources, and escalate cases outside your authority.",
      "Record customer interactions, decisions, and follow-up commitments in the designated case system.",
      "Identify repeated issues and share concise feedback that can improve help content or service workflows.",
    ],
    qualifications: [
      "Clear, respectful written and verbal communication appropriate to the service channel.",
      "Able to listen, clarify the actual problem, and explain next steps without overpromising.",
      "Comfortable documenting cases and following privacy and escalation procedures.",
      "Reliable availability for the schedule and time-zone overlap stated in the listing.",
    ],
  },
  sales: {
    overview: "The role supports a defined part of the sales or prospecting cycle, using approved audience criteria and outreach practices. Accurate activity records and relevant follow-up help the team measure progress without sending indiscriminate messages.",
    responsibilities: [
      "Research, qualify, contact, or follow up with prospects according to the approved audience and outreach process.",
      "Use the designated CRM to keep contact details, conversation history, and next actions accurate.",
      "Ask relevant discovery questions, communicate the approved offer clearly, and route unsuitable or complex enquiries appropriately.",
      "Review activity and outcome measures with the team and adjust work to agreed targets and quality standards.",
    ],
    qualifications: [
      "Confident, professional communication and the ability to adapt a conversation to a prospect's context.",
      "Able to organize follow-ups and maintain accurate CRM records.",
      "Comfortable working toward clear activity or conversion goals while following approved outreach rules.",
      "Can describe a relevant customer, prospecting, appointment-setting, or sales outcome.",
    ],
  },
  finance: {
    overview: "The role handles financial records, transactions, reporting, analysis, or controls defined by the team. Reconciled figures, documented assumptions, confidentiality, and timely escalation of discrepancies are essential.",
    responsibilities: [
      "Prepare, review, reconcile, or analyze the financial records assigned to the role.",
      "Check source documents, calculations, and period details, and investigate material variances before finalizing work.",
      "Maintain an audit trail for adjustments and communicate assumptions, exceptions, and deadlines clearly.",
      "Protect financial and personal data and follow the access and approval controls for each task.",
    ],
    qualifications: [
      "Working knowledge of the accounting, finance, reporting, or analytical methods relevant to the position.",
      "Able to demonstrate careful reconciliation, calculation, or review work.",
      "Comfortable with the spreadsheet and finance systems required for the role.",
      "Discreet handling of confidential records and a habit of documenting decisions.",
    ],
  },
  healthcare: {
    overview: "The work supports the clinical, research, coding, or care-delivery responsibilities stated in the listing. Accurate records, patient privacy, appropriate escalation, and compliance with the rules applicable to the service location are required.",
    responsibilities: [
      "Complete the clinical, research, coding, or care tasks defined for the position and within your professional scope.",
      "Create clear, timely records using the approved systems and the documentation standards for the work.",
      "Protect patient and study information and follow applicable privacy, consent, and safety procedures.",
      "Escalate clinical, coding, data-quality, or safety concerns through the established route rather than making unsupported assumptions.",
    ],
    qualifications: [
      "Relevant education, training, and experience for the clinical or healthcare function described in the listing.",
      "Current licence, registration, or credential in the required jurisdiction when the duties legally require one.",
      "Sound understanding of confidentiality, documentation, and escalation responsibilities.",
      "Able to use the healthcare, research, coding, or telehealth systems required for the role.",
    ],
  },
  legal: {
    overview: "The role supports legal advice, contract review, or compliance work within the matters and jurisdictions assigned by the team. Clear issue-spotting, deadline control, careful version handling, and confidentiality are critical.",
    responsibilities: [
      "Review, draft, organize, or advise on the agreements and legal matters assigned to the position.",
      "Identify material obligations, risks, exceptions, and open questions, and explain them in concise, practical language.",
      "Track versions, approvals, deadlines, and supporting records so work can be reviewed and handed over reliably.",
      "Protect privileged and confidential information and escalate issues outside the agreed remit or jurisdiction.",
    ],
    qualifications: [
      "Relevant legal education and experience for the work described in the role summary.",
      "Admission or current authorization in the relevant jurisdiction when the work requires legal practice there.",
      "Strong contract-reading, legal-research, issue-spotting, and written communication skills.",
      "Reliable handling of confidential matters and competing deadlines.",
    ],
  },
  creative: {
    overview: "The role turns an approved brief into visual, audio, or video deliverables for the intended audience and channel. Strong craft is paired with organized source files, responsive iteration, and a clean production hand-off.",
    responsibilities: [
      "Create or edit assets against the approved brief, brand guidance, audience, and delivery specifications.",
      "Present work for review, incorporate actionable feedback, and keep versions and source files organized.",
      "Check exports for dimensions, legibility, accessibility, sound or visual quality, and platform requirements.",
      "Communicate dependencies and delivery risks early and hand off final files in the agreed formats.",
    ],
    qualifications: [
      "A portfolio or work sample that demonstrates craft relevant to the position.",
      "Confident use of the design, editing, or production tools needed for the work.",
      "Able to interpret a brief, explain creative decisions, and respond constructively to review.",
      "Organized file management and reliable delivery against agreed deadlines.",
    ],
  },
  content: {
    overview: "The role creates, reviews, edits, or converts content for a defined audience and format. Accuracy, consistent style, source awareness, and clear treatment of uncertain material are important throughout the workflow.",
    responsibilities: [
      "Draft, edit, proofread, caption, transcribe, or prepare the content requested for the role.",
      "Check names, terminology, factual claims, formatting, and style against the supplied source and guidance.",
      "Mark unclear source material or unresolved facts for review instead of guessing or silently changing meaning.",
      "Track revisions and deliver clean, accessible files in the requested format and on schedule.",
    ],
    qualifications: [
      "Strong command of the language, subject matter, or content format required by the listing.",
      "Able to provide a relevant sample and explain the research, editing, or quality checks used.",
      "Careful fact-checking, proofreading, and respect for the source's intended meaning.",
      "Reliable use of the publishing, editing, transcription, or collaboration tools required for the role.",
    ],
  },
  marketing: {
    overview: "The role plans, coordinates, publishes, or measures marketing activity for the audiences and channels assigned to it. Work should follow approved brand guidance and use performance evidence to inform improvements.",
    responsibilities: [
      "Plan and deliver the content, campaign, search, community, or channel work described in the position summary.",
      "Coordinate briefs, assets, approvals, publishing dates, and hand-offs with relevant collaborators.",
      "Monitor agreed performance measures, identify changes or issues, and summarize what the evidence shows.",
      "Maintain accurate campaign records and keep messaging consistent with approved brand and compliance guidance.",
    ],
    qualifications: [
      "Practical knowledge of the marketing channel or discipline named in the listing.",
      "Able to explain a campaign, content, audience, or optimization decision and the result measured.",
      "Comfortable with the analytics, publishing, or campaign tools required for the role.",
      "Organized coordination, clear writing, and care with brand consistency.",
    ],
  },
  education: {
    overview: "The role helps learners understand defined subjects through tutoring, learning resources, or instructional experiences. Clear explanations, accessible materials, useful feedback, and appropriate handling of learner information are central to the work.",
    responsibilities: [
      "Prepare or deliver lessons, learning materials, or tutoring sessions aligned with the stated subject and learner needs.",
      "Explain concepts in clear steps and adapt examples when learners need another route to understanding.",
      "Give constructive, timely feedback and record progress using the agreed learning platform or process.",
      "Keep learning content accurate, accessible, and appropriate for the intended age and level.",
    ],
    qualifications: [
      "Strong knowledge of the subject or instructional area named in the role summary.",
      "Able to explain complex material clearly and respond to learner questions with patience.",
      "Comfortable using the online learning or content-authoring tools required for the position.",
      "Reliable preparation, record-keeping, and communication with the relevant learning team.",
    ],
  },
  people: {
    overview: "The role coordinates recruiting or people operations through clear, fair, and confidential processes. Accurate records, timely communication, and respectful treatment of every candidate or colleague are important at each step.",
    responsibilities: [
      "Coordinate the recruiting or people-process steps assigned to the position, including schedules and follow-ups.",
      "Keep applicant or employee records accurate, access-controlled, and up to date in the designated system.",
      "Communicate process details consistently and route questions to the appropriate decision-maker.",
      "Track outstanding actions and deadlines while protecting confidential personal information.",
    ],
    qualifications: [
      "Experience or demonstrated capability in recruiting, HR administration, scheduling, or people operations relevant to the role.",
      "Strong written communication and careful coordination across multiple participants.",
      "Comfortable using applicant-tracking, HR, calendar, or document systems.",
      "Discretion, accuracy, and a fair, respectful approach to candidate and employee records.",
    ],
  },
  operations: {
    overview: "The role keeps a defined administrative or operating workflow accurate and moving. It combines record-keeping, prioritization, follow-through, and timely escalation when information is missing or a process is blocked.",
    responsibilities: [
      "Process the requests, records, schedules, orders, or coordination tasks assigned to the position.",
      "Check required details before progressing a task and follow the documented approval or hand-off steps.",
      "Maintain accurate trackers and communicate outstanding actions, exceptions, and deadlines to the right people.",
      "Spot recurring delays or errors and suggest practical improvements supported by examples.",
    ],
    qualifications: [
      "Strong organization and reliable follow-through across multiple active tasks.",
      "Able to maintain accurate records and recognize when an item needs clarification or escalation.",
      "Comfortable with the office, scheduling, inventory, or workflow systems required by the role.",
      "Clear written communication and appropriate handling of business or customer information.",
    ],
  },
  product: {
    overview: "The role connects user or business needs to clear requirements, plans, analysis, or delivery practices. It helps teams make decisions transparently and keeps priorities, risks, and outcomes visible to stakeholders.",
    responsibilities: [
      "Gather and clarify requirements, user needs, process evidence, or delivery constraints relevant to the position.",
      "Translate findings into clear documentation, analysis, priorities, or work items the team can act on.",
      "Facilitate alignment across contributors, record decisions, and surface dependencies or trade-offs early.",
      "Review outcomes against agreed goals and use evidence to recommend the next improvement.",
    ],
    qualifications: [
      "Demonstrated analytical, planning, facilitation, or product-delivery skills relevant to the role.",
      "Able to organize ambiguous input into clear requirements, options, and documented decisions.",
      "Comfortable with the planning, analytics, or collaboration tools named in the position.",
      "Clear communication with technical and non-technical stakeholders.",
    ],
  },
  leadership: {
    overview: "The role owns a defined area of strategy and delivery, aligns people around measurable priorities, and makes decisions within agreed authority. Leaders are expected to communicate trade-offs, develop reliable operating practices, and remain accountable for outcomes.",
    responsibilities: [
      "Set priorities and operating goals for the function or team within the agreed business strategy.",
      "Translate goals into accountable plans, decision rights, measures, and regular review points.",
      "Coach and coordinate leaders or specialists, resolve cross-team dependencies, and address delivery risks.",
      "Report results candidly, explain trade-offs, and adjust plans when evidence or business needs change.",
    ],
    qualifications: [
      "Relevant leadership experience with outcomes that can be clearly described and evidenced.",
      "Ability to set measurable direction while giving specialists the context and authority to deliver.",
      "Strong decision-making, stakeholder communication, and cross-functional collaboration.",
      "A record of building accountable, inclusive, and sustainable team practices.",
    ],
  },
  general: {
    overview: "The position has a defined scope and work output described in the summary. Day-to-day expectations, quality criteria, and escalation points are agreed with the hiring team so applicants can assess fit before applying.",
    responsibilities: [
      "Complete the tasks and deliverables described in the role summary and team instructions.",
      "Check work against the stated quality criteria and correct or flag discrepancies before hand-off.",
      "Keep relevant records current and communicate progress, questions, and blockers clearly.",
      "Protect business or customer information and follow the processes that apply to the work.",
    ],
    qualifications: [
      "Demonstrated ability or transferable experience relevant to the work described in the listing.",
      "Reliable attention to detail and follow-through on agreed deadlines.",
      "Comfortable with the tools and written instructions needed for the position.",
      "Clear communication and appropriate handling of confidential information.",
    ],
  },
};

const GENERIC_RESPONSIBILITY_LINES = new Set([
  "lead strategy and execution in your area of ownership",
  "set standards and mentor others across the org",
  "own defined deliverables and meet weekly targets",
  "work with engineering, design and ops peers to ship",
  "follow clear instructions and maintain a consistent quality standard",
  "complete assigned tasks accurately and on time each shift",
  "flag any issues or unclear steps to your team lead",
  "communicate clearly and collaborate with the wider team",
]);

const GENERIC_QUALIFICATION_LINES = new Set([
  "5+ years of deep, demonstrated experience in the discipline",
  "a track record of shipping significant outcomes",
  "excellent communication and leadership skills",
  "experience working in senior or leadership capacity",
  "3-5 years in a related role with a strong track record",
  "hands-on command of the relevant tooling and methods",
  "excellent written english and clear communication",
  "comfortable working independently in a remote team",
  "reliable internet and a quiet, professional workspace",
  "basic computer skills and comfort with everyday software",
  "strong attention to detail and good time management",
  "willingness to learn; full training is provided on the job",
]);

function hasBoilerplateLines(values: string[], knownLines: Set<string>): boolean {
  return values.filter((value) => knownLines.has(value.trim().toLocaleLowerCase())).length >= 2;
}

/** Replace only the known template copy; preserve content written by a human. */
export function enrichBoilerplateRoleContent(
  job: RoleContentInput,
): RoleContentOutput {
  const profile = PROFILES[inferApplicationQuestionTrack(job.slug, job.title)];
  const lowerOverview = job.overview.toLocaleLowerCase();
  const overviewIsTemplate =
    lowerOverview.includes("a senior role where you lead strategy and execution") ||
    lowerOverview.includes("this is an excellent on-ramp role with full training") ||
    lowerOverview.includes("you will own a clear part of the operation");

  return {
    overview: overviewIsTemplate
      ? `${job.summary.trim()} ${profile.overview}`
      : job.overview,
    responsibilities: hasBoilerplateLines(job.responsibilities, GENERIC_RESPONSIBILITY_LINES)
      ? profile.responsibilities
      : job.responsibilities,
    requiredQualifications: hasBoilerplateLines(job.requiredQualifications, GENERIC_QUALIFICATION_LINES)
      ? profile.qualifications
      : job.requiredQualifications,
  };
}
