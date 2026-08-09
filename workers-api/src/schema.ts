import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const applicationStatusEnum = pgEnum("application_status", [
  "New",
  "Reviewing",
  "Shortlisted",
  "Rejected",
  "Hired",
]);

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  position: text("position").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  country: text("country").notNull(),
  city: text("city").notNull(),
  timezone: text("timezone").notNull(),
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  yearsExperience: text("years_experience").notNull(),
  education: text("education").notNull(),
  englishProficiency: text("english_proficiency").notNull(),
  noticePeriod: text("notice_period").notNull(),
  expectedSalary: text("expected_salary").notNull(),
  earliestStartDate: text("earliest_start_date").notNull(),
  skills: text("skills").notNull(),
  relevantExperience: text("relevant_experience").notNull(),
  coverLetter: text("cover_letter").notNull(),
  resumePath: text("resume_path"),
  resumeFilename: text("resume_filename"),
  status: applicationStatusEnum("status").default("New").notNull(),
  referenceCode: text("reference_code").notNull().unique(),
  meetLink: text("meet_link"),
  interviewInstructions: text("interview_instructions"),
  meetingKey: text("meeting_key"),
  backgroundUrl: text("background_url"),
  roomLink: text("room_link"),
  nextStepDelay: integer("next_step_delay"),
});

export const insertApplicationSchema = z.object({
  position: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  country: z.string().min(1),
  city: z.string().min(1),
  timezone: z.string().min(1),
  linkedinUrl: z.string().url().optional().nullable(),
  portfolioUrl: z.string().url().optional().nullable(),
  yearsExperience: z.string().min(1),
  education: z.string().min(1),
  englishProficiency: z.string().min(1),
  noticePeriod: z.string().min(1),
  expectedSalary: z.string().min(1),
  earliestStartDate: z.string().date(),
  skills: z.string().min(1),
  relevantExperience: z.string().min(1),
  coverLetter: z.string().min(1),
});

export type Application = typeof applications.$inferSelect;
export type CreateApplicationInput = z.infer<typeof insertApplicationSchema> & {
  resumePath?: string | null;
  resumeFilename?: string | null;
};
export type ApplicationStatus =
  (typeof applicationStatusEnum.enumValues)[number];

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  employmentType: text("employment_type").notNull(),
  workArrangement: text("work_arrangement").notNull(),
  experienceLevel: text("experience_level").notNull(),
  experience: text("experience").notNull(),
  compensation: text("compensation").notNull(),
  postedDate: text("posted_date").notNull(),
  summary: text("summary").notNull(),
  overview: text("overview").notNull(),
  responsibilities: text("responsibilities").array().notNull().default([]),
  requiredQualifications: text("required_qualifications")
    .array()
    .notNull()
    .default([]),
  preferredQualifications: text("preferred_qualifications")
    .array()
    .notNull()
    .default([]),
  skills: text("skills").array().notNull().default([]),
  softwareTools: text("software_tools").array().notNull().default([]),
  benefits: text("benefits").array().notNull().default([]),
  workingHours: text("working_hours").notNull(),
  hiringProcess: text("hiring_process").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type CreateJobInput = typeof jobs.$inferInsert;

export const magicTokens = pgTable("magic_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const candidateSessions = pgTable("candidate_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revoked: boolean("revoked").default(false).notNull(),
});

export type MagicToken = typeof magicTokens.$inferSelect;
export type CreateMagicTokenInput = typeof magicTokens.$inferInsert;

export type CandidateSession = typeof candidateSessions.$inferSelect;
export type CreateCandidateSessionInput = typeof candidateSessions.$inferInsert;

export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referralCode: text("referral_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  referredBy: text("referred_by"),
  jobTitle: text("job_title"),
  meetingUrl: text("meeting_url"),
  phone: text("phone"),
  city: text("city"),
  country: text("country"),
  address: text("address"),
  zipCode: text("zip_code"),
  source: text("source"),
  notes: text("notes"),
  status: text("status").notNull().default("Pending"),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  clickCount: integer("click_count").notNull().default(0),
  lastClickedAt: timestamp("last_clicked_at", { withTimezone: true }),
  lastDevice: text("last_device"),
  contentOverrides: jsonb("content_overrides")
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const referralClicks = pgTable("referral_clicks", {
  id: uuid("id").primaryKey().defaultRandom(),
  referralId: uuid("referral_id")
    .notNull()
    .references(() => referrals.id, { onDelete: "cascade" }),
  deviceType: text("device_type").notNull().default("unknown"),
  clickedAt: timestamp("clicked_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const referralContent = pgTable("referral_content", {
  key: text("key").primaryKey(),
  body: text("body").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const referralSettings = pgTable("referral_settings", {
  id: integer("id").primaryKey(),
  dailySendLimit: integer("daily_send_limit").notNull().default(5),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type CreateReferralInput = Omit<
  typeof referrals.$inferInsert,
  "referralCode"
>;
export type ReferralClick = typeof referralClicks.$inferSelect;
export type ReferralContentRow = typeof referralContent.$inferSelect;
export type ReferralSettingsRow = typeof referralSettings.$inferSelect;

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  postalCode: text("postal_code"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type CreateContactInput = typeof contacts.$inferInsert;

export const footprints = pgTable("footprints", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectType: text("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  event: text("event").notNull(),
  device: text("device").notNull().default("unknown"),
  userAgent: text("user_agent"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Footprint = typeof footprints.$inferSelect;

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  targetEmail: text("target_email"),
  detail: jsonb("detail"),
  status: text("status").notNull().default("ok"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Activity = typeof activities.$inferSelect;
export type CreateActivityInput = typeof activities.$inferInsert;
