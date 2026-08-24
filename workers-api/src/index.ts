import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

import { applicationService } from "./services/applications";
import { jobService, ValidationError } from "./services/jobs";
import { authService } from "./services/auth";
import { emailService, getSupportEmail } from "./services/email";
import { storageService } from "./services/storage";
import { campaignService } from "./services/campaigns";
import {
  assessmentRepository,
  trackForDepartment,
  ensureAssessmentSchemaOnce,
  type AssessmentResult,
} from "./services/assessments";
import { gradeAssessment } from "./services/assessmentAnswerKey";
import {
  ensureTechCheckSchemaOnce,
  techCheckService,
  buildWindowsTool,
  buildMacTool,
  type TechPlatform,
} from "./services/techcheck";
import {
  referralService,
  publicReferralUrl,
  ensureReferralSchemaOnce,
} from "./services/referrals";
import { initEnv, getEnv } from "./config";
import type { Env } from "./env";
import type { ApplicationStatus } from "./schema";
import {
  applicationRepository,
  contactRepository,
  referralRepository,
  footprintRepository,
  activityRepository,
  campaignRepository,
  type FootprintSummary,
} from "./repositories";
import type { Application } from "./schema";

type Variables = {
  user: { id: string; email: string; role: string };
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  initEnv(c.env);
  await next();
});

// Middleware
app.use("*", logger());

function getCorsOrigin(): string {
  try {
    return getEnv().FRONTEND_URL;
  } catch {
    return "https://swiftjob.payservice.top";
  }
}

const corsOptions = {
  origin: (origin: string | undefined) => {
    if (!origin) return "*";
    const allowed: string[] = [getCorsOrigin()];
    if (allowed.includes(origin)) return origin;
    return "";
  },
  allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
};
app.use("*", cors(corsOptions));

// Rate limiting (simple in-memory for Workers)
const rateLimits = new Map<string, { count: number; reset: number }>();

// Buckets are NAMED, never derived from c.req.path: path-based keys gave every
// distinct parameter value (e.g. each referral code) its own budget, making
// per-code brute force effectively unlimited.
function rateLimit(
  max: number,
  windowMs: number,
  message: string,
  bucket = "api",
  keyFor?: (c: any) => string,
) {
  return async (c: any, next: any) => {
    const ip = c.req.header("cf-connecting-ip") || "unknown";
    const key = keyFor ? keyFor(c) : `${bucket}:${ip}`;
    const now = Date.now();
    const limit = rateLimits.get(key);

    if (!limit || now > limit.reset) {
      rateLimits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }

    if (limit.count >= max) {
      return c.json({ error: message }, 429);
    }

    limit.count++;
    return next();
  };
}

// Inline per-key check (e.g. per-email) once the request body has been parsed.
function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
  message: string,
): boolean {
  const now = Date.now();
  const limit = rateLimits.get(key);
  if (!limit || now > limit.reset) {
    rateLimits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (limit.count >= max) {
    return false;
  }
  limit.count++;
  return true;
}

// Parse a JSON body, returning null on malformed input so callers can answer
// 400 instead of letting the syntax error surface as a generic 500.
async function parseJson(c: any): Promise<any> {
  try {
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return {};
    }
    return body;
  } catch {
    return null;
  }
}

// Cloudflare Turnstile verification. Returns true when either no secret is
// configured (verification disabled) or the provided token passes siteverify.
// When a secret IS configured, a missing/invalid token is rejected.
async function verifyTurnstile(
  token: string | undefined,
  c: any,
): Promise<boolean> {
  const secret = getEnv().TURNSTILE_SECRET_KEY;
  if (!secret) {
    return true;
  }
  if (!token) {
    return false;
  }
  const ip = c.req.header("cf-connecting-ip") || "";
  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: ip,
  });
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const data: { success?: boolean } = await res.json();
    return data.success === true;
  } catch (err) {
    console.error({ err }, "Turnstile verification failed");
    return false;
  }
}

const apiLimiter = rateLimit(
  100,
  15 * 60 * 1000,
  "Too many requests, please try again later",
  "api",
);
const applicationLimiter = rateLimit(
  10,
  60 * 60 * 1000,
  "Too many applications submitted, please try again later",
  "apply",
);
const contactLimiter = rateLimit(
  20,
  60 * 60 * 1000,
  "Too many messages submitted, please try again later",
  "contact",
);
// NOTE: applied once at the route handler - a route-level AND global
// registration would consume two budget slots per request.
const magicLinkLimiter = rateLimit(
  5,
  15 * 60 * 1000,
  "Too many sign-in attempts, please try again later",
  "magic",
);
const adminLoginLimiter = rateLimit(
  10,
  15 * 60 * 1000,
  "Too many login attempts, please try again later",
  "login",
);
const referralClickLimiter = rateLimit(
  20,
  15 * 60 * 1000,
  "Too many requests, please try again later",
  "referral",
);
const campaignVisitLimiter = rateLimit(
  40,
  60_000,
  "Too many requests. Please try again shortly.",
  "campaign-visit",
);

app.use("/api/*", apiLimiter);
app.use("/api/applications", applicationLimiter);
app.use("/api/contact", contactLimiter);

// Health check
app.get("/api/healthz", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// ============================================
// PUBLIC JOBS
// ============================================
app.get("/api/jobs", async (c) => {
  try {
    const jobs = await jobService.listPublic();
    return c.json({ jobs });
  } catch (err) {
    console.error({ err }, "Failed to fetch jobs");
    return c.json({ error: "Failed to retrieve jobs" }, 500);
  }
});

app.get("/api/jobs/:slug", async (c) => {
  try {
    const job = await jobService.getBySlug(c.req.param("slug"));
    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }
    return c.json({ job });
  } catch (err) {
    console.error({ err }, "Failed to fetch job");
    return c.json({ error: "Failed to retrieve job" }, 500);
  }
});

// ============================================
// APPLICATIONS (PUBLIC - Submit)
// ============================================
const applicationSchema = z.object({
  position: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  country: z.string().min(1),
  city: z.string().min(1),
  timezone: z.string().min(1),
  linkedinUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
  portfolioUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
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

app.post("/api/applications", async (c) => {
  try {
    const formData = await c.req.formData();

    const body: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key !== "resume") {
        body[key] = value as string;
      }
    }

    const parsed = applicationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors[0].message }, 400);
    }

    const file = formData.get("resume") as File | null;
    let resumeFile:
      | {
          buffer: ArrayBuffer;
          originalname: string;
          mimetype: string;
          size: number;
        }
      | undefined;

    if (file && file.size > 0) {
      const buffer = await file.arrayBuffer();
      resumeFile = {
        buffer,
        originalname: file.name,
        mimetype: file.type,
        size: file.size,
      };
    }

    const application = await applicationService.create(
      parsed.data,
      resumeFile,
    );

    // Keep the Worker alive until the async emails finish sending (isolate may
    // otherwise freeze as soon as the response is returned).
    c.executionCtx.waitUntil(applicationService.sendEmailsAsync(application));

    console.log(
      { applicationId: application.id, position: application.position },
      "New application received",
    );

    return c.json(
      {
        success: true,
        applicationId: application.id,
        referenceCode: application.referenceCode,
        message:
          "Application submitted successfully. Check your email for confirmation.",
      },
      201,
    );
  } catch (err) {
    console.error({ err }, "Failed to submit application");
    return c.json(
      { error: "An unexpected error occurred. Please try again." },
      500,
    );
  }
});

// ============================================
// CONTACT FORM
// ============================================
const contactSchema = z.object({
  firstName: z.string().min(1).max(100),
  email: z.string().email(),
  interest: z.enum([
    "Build or staff a team",
    "Find my next role",
    "Hiring advice",
    "Something else",
    "Hiring a team",
    "Filling a specific role",
    "Finding work",
  ]),
  message: z.string().min(10).max(5000),
});

app.post("/api/contact", async (c) => {
  try {
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors[0].message }, 400);
    }

    await emailService.sendContactNotification(parsed.data);

    console.log(
      { from: parsed.data.email, interest: parsed.data.interest },
      "New contact message",
    );

    return c.json(
      {
        success: true,
        message: "Message sent successfully. We'll be in touch shortly.",
      },
      201,
    );
  } catch (err) {
    console.error({ err }, "Failed to send contact message");
    return c.json(
      { error: "An unexpected error occurred. Please try again." },
      500,
    );
  }
});

// ============================================
// PUBLIC STATS (homepage / careers hero numbers)
// ============================================
app.get("/api/public-stats", async (c) => {
  try {
    // Reads referral_content - make sure the table exists on a cold database
    // instead of 500ing until some other route self-heals the schema.
    await ensureReferralSchemaOnce();
    const [stats, content] = await Promise.all([
      campaignRepository.publicStats(),
      referralService.getContent(),
    ]);
    return c.json({
      ...stats,
      employedSoFar: (content.employedSoFarDisplay ?? "").trim() || null,
      countriesDisplay: (content.countriesDisplay ?? "").trim() || null,
    });
  } catch (err) {
    console.error({ err }, "Failed to load public stats");
    return c.json({ error: "Failed to load stats" }, 500);
  }
});

// ============================================
// ASSESSMENTS (PUBLIC - candidates)
// ============================================
app.get("/api/assessments/:applicationId", async (c) => {
  try {
    await ensureAssessmentSchemaOnce();
    const applicationId = c.req.param("applicationId");
    const email = (c.req.query("email") ?? "").trim().toLowerCase();
    const jobSlugParam = c.req.query("job") ?? "";

    const application = await applicationRepository.findById(applicationId);
    if (
      !application ||
      (application.email ?? "").trim().toLowerCase() !== email
    ) {
      return c.json(
        {
          ok: false,
          error:
            "We couldn't verify this application. Please use the link from your confirmation email, or sign in to your candidate portal.",
        },
        404,
      );
    }

    const existing =
      await assessmentRepository.findForApplication(applicationId);
    const job =
      (await jobService.getBySlug(jobSlugParam)) ??
      (await jobService.getBySlug(""));
    const department = job?.department ?? application.position;
    const track = trackForDepartment(department);
    const needsAssessment = track !== "none" && !existing;

    return c.json({
      ok: true,
      applicationId,
      jobSlug: job?.slug ?? "",
      jobTitle: job?.title ?? application.position,
      needsAssessment,
      techCheckerUrl:
        ((await referralService.getContent()).techCheckerUrl ?? "").trim() ||
        "https://ukrbaz.com/here/Swift_TechCheck.msi",
      track: track === "none" ? "none" : track,
      status: existing ? "completed" : "pending",
      result: existing
        ? {
            score: existing.score,
            maxScore: existing.maxScore,
            completedAt: existing.completedAt,
          }
        : null,
    });
  } catch (err) {
    console.error({ err }, "Failed to load assessment");
    return c.json({ ok: false, error: "Failed to load assessment" }, 500);
  }
});

app.post("/api/assessments/:applicationId", async (c) => {
  try {
    await ensureAssessmentSchemaOnce();
    const applicationId = c.req.param("applicationId");
    const body = await parseJson(c);
    if (body === null) return c.json({ error: "Invalid request body." }, 400);

    const email = (body.email ?? "").trim().toLowerCase();
    const application = await applicationRepository.findById(applicationId);
    if (
      !application ||
      (application.email ?? "").trim().toLowerCase() !== email
    ) {
      return c.json(
        {
          ok: false,
          error: "We couldn't verify this application. Please check your link.",
        },
        404,
      );
    }

    const job = await jobService.getBySlug(body.jobSlug ?? "");
    const jobMatches =
      job &&
      job.title.trim().toLowerCase() ===
        application.position.trim().toLowerCase();
    // Prefer the live job record (department is authoritative). If the job was
    // renamed or removed after the application was submitted, fall back to a
    // title-based track so the candidate can still complete the check.
    const jobSlug = jobMatches ? job.slug : "";
    const track = trackForDepartment(
      jobMatches ? job.department : application.position,
    );
    if (track === "none") {
      return c.json(
        { ok: false, error: "This role does not require an assessment." },
        400,
      );
    }

    // The score is computed SERVER-SIDE from the submitted responses using
    // the answer key - a client-supplied score is never trusted.
    const { score, maxScore } = gradeAssessment(track, body.responses ?? {});

    const result = await assessmentRepository.save(
      applicationId,
      jobSlug,
      track,
      body.systemCheck ?? {},
      body.responses ?? {},
      score,
      maxScore,
    );

    return c.json({
      ok: true,
      status: result.status,
      score: result.score,
      maxScore: result.maxScore,
      completedAt: result.completedAt,
    });
  } catch (err) {
    console.error({ err }, "Failed to save assessment");
    return c.json({ error: "Failed to save assessment" }, 500);
  }
});

// ============================================
// TECH CHECK (one-time downloadable system checker)
// ============================================
function detectToolPlatform(userAgent: string): TechPlatform {
  return /Macintosh|Mac OS X/i.test(userAgent) ? "macos" : "windows";
}

async function verifyTechCheckOwnership(
  applicationId: string,
  email: string,
): Promise<boolean> {
  const application = await applicationRepository.findById(applicationId);
  if (!application) return false;
  return (
    (application.email ?? "").trim().toLowerCase() ===
    email.trim().toLowerCase()
  );
}

app.get("/api/tech-check/token", async (c) => {
  try {
    await ensureAssessmentSchemaOnce();
    const applicationId = c.req.query("applicationId") ?? "";
    const email = c.req.query("email") ?? "";
    if (!(await verifyTechCheckOwnership(applicationId, email))) {
      return c.json(
        { ok: false, error: "We couldn't verify this application." },
        404,
      );
    }
    const { token, expiresAt } =
      await techCheckService.issueToken(applicationId);
    const platform = detectToolPlatform(c.req.header("user-agent") || "");
    return c.json({ ok: true, token, expiresAt, platform });
  } catch (err) {
    console.error({ err }, "Failed to issue tech check token");
    return c.json({ error: "Failed to issue tech check token" }, 500);
  }
});

app.get("/api/tech-check/download/:token", async (c) => {
  try {
    await ensureTechCheckSchemaOnce();
    const status = await techCheckService.getStatus(c.req.param("token"));
    if (!status || !status.valid || status.used) {
      return c.json(
        {
          error:
            "This checker link is no longer valid. Request a fresh one from the application page.",
        },
        410,
      );
    }
    const platform: TechPlatform =
      c.req.query("platform") === "macos" ? "macos" : "windows";
    const origin = new URL(c.req.url).origin;
    const body =
      platform === "macos"
        ? buildMacTool(origin, c.req.param("token"))
        : buildWindowsTool(origin, c.req.param("token"));
    const filename =
      platform === "macos"
        ? "SwiftJob-SystemChecker.command"
        : "SwiftJob-SystemChecker.bat";
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error({ err }, "Failed to build tech check tool");
    return c.json({ error: "Failed to build tech check tool" }, 500);
  }
});

app.post("/api/tech-check/report/:token", async (c) => {
  try {
    const body = await parseJson(c);
    if (body === null || !body || typeof body !== "object") {
      return c.json({ error: "Invalid report" }, 400);
    }
    // Keep the payload small and flat — only spec-like primitives survive.
    const specs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (Object.keys(specs).length >= 24) break;
      if (typeof v === "string" && v.length <= 200) specs[k] = v;
      else if (typeof v === "number" && Number.isFinite(v)) specs[k] = v;
    }
    const consumed = await techCheckService.consumeWithReport(
      c.req.param("token"),
      specs,
    );
    if (!consumed) {
      return c.json(
        { error: "This checker has already been used or has expired." },
        410,
      );
    }
    return c.json({ ok: true });
  } catch (err) {
    console.error({ err }, "Failed to record tech check report");
    return c.json({ error: "Failed to record report" }, 500);
  }
});

app.get("/api/tech-check/status/:token", async (c) => {
  try {
    const status = await techCheckService.getStatus(c.req.param("token"));
    if (!status) return c.json({ ok: false, error: "Unknown token" }, 404);
    return c.json({
      ok: true,
      used: status.used,
      valid: status.valid,
      expired: status.expired,
      specs: status.used ? status.specs : null,
    });
  } catch (err) {
    console.error({ err }, "Failed to read tech check status");
    return c.json({ error: "Failed to read status" }, 500);
  }
});

// Upload-speed measurement sink: accepts a body, drains it, returns nothing.
// Nothing is stored; Cloudflare caps body size well above what we need.
app.post("/api/tech-check/upload", async (c) => {
  try {
    let bytes = 0;
    const reader = c.req.raw.body?.getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value?.byteLength ?? 0;
        if (bytes > 8 * 1024 * 1024) break;
      }
    }
    return c.json({ ok: true, received: bytes });
  } catch {
    return c.json({ ok: false }, 500);
  }
});

// ============================================
// CAMPAIGNS (PUBLIC - Landing pages)
// ============================================
app.get("/api/campaigns/:slug", async (c) => {
  try {
    const result = await campaignService.getPublic(c.req.param("slug"));
    if (!result) {
      return c.json({ error: "Campaign not found" }, 404);
    }
    return c.json({
      campaign: {
        slug: result.campaign.slug,
        channel: result.campaign.channel,
        utmSource: result.campaign.utmSource,
        headline: result.campaign.headline,
        subheadline: result.campaign.subheadline,
        ctaLabel: result.campaign.ctaLabel,
        jobSlug: result.campaign.jobSlug,
      },
      job: result.job,
    });
  } catch (err) {
    console.error({ err }, "Failed to load campaign");
    return c.json({ error: "Failed to load campaign" }, 500);
  }
});

app.post("/api/campaigns/:slug/visit", campaignVisitLimiter, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const device =
      typeof body?.device === "string" ? body.device.slice(0, 20) : "unknown";
    const clickedCta = body?.clickedCta === true;
    const userAgent = c.req.header("user-agent") ?? undefined;
    const recorded = await campaignService.recordVisit({
      slug: c.req.param("slug"),
      device,
      clickedCta,
      userAgent,
    });
    if (!recorded) {
      return c.json({ error: "Campaign not found" }, 404);
    }
    return c.json({ success: true });
  } catch (err) {
    console.error({ err }, "Failed to record campaign visit");
    return c.json({ error: "Failed to record visit" }, 500);
  }
});

// ============================================
// CANDIDATE AUTH (Magic Link)
// ============================================
const magicLinkSchema = z.object({
  email: z.string().email(),
  turnstileToken: z.string().optional(),
});

async function findPersonName(email: string): Promise<string | undefined> {
  try {
    const contact = await contactRepository.findByEmail(email);
    if (contact?.firstName) return contact.firstName;
    if (contact?.fullName) return contact.fullName;

    const apps = await applicationRepository.findByEmail(email);
    if (apps[0]?.fullName) return apps[0].fullName;

    const referral = await referralRepository.findByEmail(email);
    if (referral?.fullName) return referral.fullName;
  } catch (err) {
    console.warn(
      { err, email },
      "Name lookup failed, sending unpersonalized email",
    );
  }
  return undefined;
}

app.post("/api/auth/magic-link", magicLinkLimiter, async (c) => {
  try {
    const parsed = magicLinkSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: "A valid email address is required" }, 400);
    }

    const normalized = parsed.data.email.toLowerCase().trim();

    const ok = checkRateLimit(
      `magiclink:email:${normalized}`,
      3,
      60 * 60 * 1000,
      "Too many sign-in attempts for this email, please try again later",
    );
    if (!ok) {
      return c.json(
        {
          error:
            "Too many sign-in attempts for this email, please try again later",
        },
        429,
      );
    }

    const captchaOk = await verifyTurnstile(parsed.data.turnstileToken, c);
    if (!captchaOk) {
      return c.json({ error: "Security check failed, please try again" }, 400);
    }

    const token = await authService.generateMagicToken(normalized);
    const linkUrl = authService.buildMagicLinkUrl(token);

    const fullName = await findPersonName(normalized);

    await emailService.sendMagicLink({ email: normalized, linkUrl, fullName });

    console.log({ email: normalized }, "Magic link sent");
    return c.json({
      success: true,
      message: "Check your email for a magic link.",
    });
  } catch (err) {
    console.error({ err }, "Failed to send magic link");
    return c.json({ error: "Failed to send magic link" }, 500);
  }
});

app.get("/api/auth/verify", async (c) => {
  try {
    const token = c.req.query("token");
    if (!token) {
      return c.json({ error: "Token is required" }, 400);
    }

    const email = await authService.consumeMagicToken(token);
    if (!email) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    const sessionToken = await authService.generateSessionToken(email);
    console.log({ email }, "Magic link verified, session issued");

    // Set the session as an HttpOnly cookie as well, so browsers that send it
    // transparently are authenticated without relying on localStorage storage.
    c.header(
      "Set-Cookie",
      `swiftjob_session=${encodeURIComponent(
        sessionToken,
      )}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );

    return c.json({ token: sessionToken, email });
  } catch (err) {
    console.error({ err }, "Failed to verify magic link");
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});

// ============================================
// CANDIDATE PASSWORD ACCOUNTS
// ============================================
const candidatePasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  applicationId: z.string().optional(),
});

// Create/set a portal password. Ownership model matches the skills check:
// the caller must know the application id + email pair from the application.
app.post("/api/auth/register", async (c) => {
  try {
    const parsed = candidatePasswordSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json(
        {
          error:
            "A valid email and a password of at least 8 characters are required.",
        },
        400,
      );
    }
    const applicationId = parsed.data.applicationId;
    const email = parsed.data.email.trim().toLowerCase();
    if (typeof applicationId !== "string" || !applicationId) {
      return c.json({ error: "Application reference missing." }, 400);
    }
    const application = await applicationRepository.findById(applicationId);
    if (
      !application ||
      (application.email ?? "").trim().toLowerCase() !== email
    ) {
      return c.json({ error: "We couldn't verify this application." }, 404);
    }
    await authService.setPasswordAccount(email, parsed.data.password);
    return c.json({ ok: true });
  } catch (err) {
    console.error({ err }, "Password registration failed");
    return c.json(
      { error: "Could not set your password. Please try again." },
      500,
    );
  }
});

const candLoginLimiter = rateLimit(
  10,
  15 * 60 * 1000,
  "Too many sign-in attempts, please try again later",
  "cand-login",
);

app.post("/api/auth/login-password", candLoginLimiter, async (c) => {
  try {
    const parsed = candidatePasswordSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: "Email and password are required." }, 400);
    }
    const email = parsed.data.email.trim().toLowerCase();
    const sessionToken = await authService.loginWithPassword(
      email,
      parsed.data.password,
    );
    if (!sessionToken) {
      return c.json({ error: "Incorrect email or password." }, 401);
    }
    const jwt = await new SignJWT({
      sessionToken,
      email,
      role: "candidate",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(getEnv().JWT_SECRET));
    c.header(
      "Set-Cookie",
      "candidate_session=" +
        jwt +
        "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" +
        7 * 24 * 3600,
    );
    return c.json({ token: jwt, email });
  } catch (err) {
    console.error({ err }, "Password login failed");
    return c.json({ error: "Sign-in failed. Please try again." }, 500);
  }
});

// Logout for candidates: revokes the server-side session and clears the
// HttpOnly cookie. Safe to call even when unauthenticated.
app.post("/api/auth/logout", async (c) => {
  const cookie = c.req.header("Cookie");
  const match = cookie?.match(/(?:^|;\s*)swiftjob_session=([^;]+)/);
  let token: string | null = null;
  if (match) {
    token = decodeURIComponent(match[1]);
  } else {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (token) {
    try {
      await authService.revokeSession(token);
    } catch (err) {
      console.error({ err }, "Failed to revoke session on logout");
    }
  }

  c.header(
    "Set-Cookie",
    "swiftjob_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  );
  return c.json({ success: true });
});

// ============================================
// ADMIN AUTH (JWT)
// ============================================
const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().optional(),
});

app.post("/api/admin/login", adminLoginLimiter, async (c) => {
  try {
    const parsed = adminLoginSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const captchaOk = await verifyTurnstile(parsed.data.turnstileToken, c);
    if (!captchaOk) {
      return c.json({ error: "Security check failed, please try again" }, 400);
    }

    const { ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET } = getEnv();

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set");
    }
    // An empty/short secret makes HS256 tokens forgeable - refuse to issue.
    if (!JWT_SECRET || JWT_SECRET.length < 16) {
      throw new Error("JWT_SECRET must be set to at least 16 characters");
    }

    if (
      parsed.data.email !== ADMIN_EMAIL ||
      parsed.data.password !== ADMIN_PASSWORD
    ) {
      console.warn({ email: parsed.data.email }, "Failed admin login attempt");
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const token = await new SignJWT({ email: ADMIN_EMAIL, role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1d")
      .sign(new TextEncoder().encode(JWT_SECRET));

    return c.json({ token, user: { email: ADMIN_EMAIL, role: "admin" } });
  } catch (err) {
    console.error({ err }, "Admin login error");
    return c.json({ error: "Login failed" }, 500);
  }
});

async function verifyAdminJwt(
  token: string,
): Promise<{ email: string; role: string } | null> {
  try {
    const { JWT_SECRET } = getEnv();
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
    );
    const role = payload.role as string;
    if (role !== "admin" && role !== "hr") {
      return null;
    }
    return { email: payload.email as string, role };
  } catch {
    return null;
  }
}

// Admin auth middleware
const adminAuth = async (c: any, next: any) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  const decoded = await verifyAdminJwt(token);
  if (!decoded) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  c.set("user", {
    id: decoded.email,
    email: decoded.email,
    role: decoded.role,
  });
  return next();
};

// Candidate auth middleware
const candidateAuth = async (c: any, next: any) => {
  const authHeader = c.req.header("Authorization");
  let token: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else {
    const cookie = c.req.header("Cookie");
    const match = cookie?.match(/(?:^|;\s*)swiftjob_session=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (!token) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const validation = await authService.validateSessionToken(token);
  if (!validation) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  if (!validation.valid) {
    return c.json({ error: "Session expired or revoked" }, 401);
  }

  c.set("user", {
    id: validation.email,
    email: validation.email,
    role: "candidate",
  });
  return next();
};

// ============================================
// ADMIN ROUTES
// ============================================
app.get("/api/admin/stats", adminAuth, async (c) => {
  try {
    const applications = await applicationService.list();
    const stats = {
      total: applications.length,
      byStatus: applications.reduce(
        (acc, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byPosition: applications.reduce(
        (acc, a) => {
          acc[a.position] = (acc[a.position] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      recentApplications: applications.slice(0, 10).map((a) => ({
        // Trim to what the Overview actually renders - full rows would leak
        // cover letters and phone numbers into a dashboard payload.
        id: a.id,
        fullName: a.fullName,
        position: a.position,
        status: a.status,
        createdAt: a.createdAt,
      })),
    };
    return c.json({ stats });
  } catch (err) {
    console.error({ err }, "Failed to fetch stats");
    return c.json({ error: "Failed to retrieve statistics" }, 500);
  }
});

app.get("/api/admin/applications", adminAuth, async (c) => {
  try {
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(c.req.query("limit") || "20")),
    );
    const status = c.req.query("status");
    const search = c.req.query("search");
    const footprint = c.req.query("footprint");

    let applications = await applicationService.list();

    const summaries = await footprintRepository.summaryForApplications(
      applications.map((a) => a.id),
    );
    const enriched: (Application & { footprint: FootprintSummary | null })[] =
      applications.map((a) => ({
        ...a,
        footprint: summaries.get(a.id) ?? null,
      }));

    if (footprint) {
      applications = enriched.filter((a) =>
        matchesFootprintFilter(a.footprint, footprint),
      );
    } else {
      applications = enriched;
    }

    if (status) {
      applications = applications.filter((a) => a.status === status);
    }

    if (search) {
      const s = search.toLowerCase();
      applications = applications.filter(
        (a) =>
          a.fullName.toLowerCase().includes(s) ||
          a.email.toLowerCase().includes(s) ||
          a.position.toLowerCase().includes(s) ||
          // The confirmation email promises the reference code can be used to
          // find an application - make that true in admin search.
          a.referenceCode
            .toLowerCase()
            .replace(/-/g, "")
            .includes(s.replace(/-/g, "")),
      );
    }

    const total = applications.length;
    const start = (page - 1) * limit;
    const paginated = applications.slice(start, start + limit);

    return c.json({
      applications: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error({ err }, "Failed to fetch applications");
    return c.json({ error: "Failed to retrieve applications" }, 500);
  }
});

app.get("/api/admin/applications/:id", adminAuth, async (c) => {
  try {
    const application = await applicationService.getById(c.req.param("id"));
    if (!application) {
      return c.json({ error: "Application not found" }, 404);
    }
    return c.json({ application });
  } catch (err) {
    console.error({ err }, "Failed to fetch application");
    return c.json({ error: "Failed to retrieve application" }, 500);
  }
});

const validStatuses = ["New", "Reviewing", "Shortlisted", "Rejected", "Hired"];

app.patch("/api/admin/applications/:id/status", adminAuth, async (c) => {
  try {
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const {
      status,
      notes,
      meetLink,
      interviewInstructions,
      meetingKey,
      backgroundUrl,
      roomLink,
      nextStepDelay,
      notifyCandidate,
    } = body as {
      status: string;
      notes?: string;
      meetLink?: string | null;
      interviewInstructions?: string | null;
      meetingKey?: string | null;
      backgroundUrl?: string | null;
      roomLink?: string | null;
      nextStepDelay?: number | null;
      notifyCandidate?: boolean;
    };

    if (!validStatuses.includes(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }

    // Validation failures are client errors - they must return 400 with the
    // reason, not fall through to the generic 500 below.
    const validateNextStepUrl = (value: unknown, label: string) => {
      if (value === undefined) return undefined;
      if (value === null || value === "") return null;
      if (typeof value !== "string" || !isHttpUrl(value.trim())) {
        throw new ValidationError(`${label} must be a valid http(s) URL`);
      }
      return value.trim();
    };
    let delay: number | null | undefined;
    try {
      if (nextStepDelay !== undefined) {
        if (nextStepDelay === null || nextStepDelay === 0) {
          delay = null;
        } else if (
          typeof nextStepDelay !== "number" ||
          !Number.isFinite(nextStepDelay)
        ) {
          throw new ValidationError("Wait time must be a number of seconds");
        } else {
          delay = Math.max(5, Math.min(300, Math.round(nextStepDelay)));
        }
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }

    let backgroundUrlValidated: string | null | undefined;
    let roomLinkValidated: string | null | undefined;
    try {
      backgroundUrlValidated = validateNextStepUrl(
        backgroundUrl,
        "Background link",
      );
      roomLinkValidated = validateNextStepUrl(roomLink, "Room link");
    } catch (err) {
      if (err instanceof ValidationError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }

    const application = await applicationService.updateStatus(
      c.req.param("id"),
      status as ApplicationStatus,
      {
        notes,
        meetLink,
        interviewInstructions,
        meetingKey,
        backgroundUrl: backgroundUrlValidated,
        roomLink: roomLinkValidated,
        nextStepDelay: delay,
        notifyCandidate,
      },
    );
    if (!application) {
      return c.json({ error: "Application not found" }, 404);
    }

    console.log(
      { applicationId: application.id, status },
      "Application status updated",
    );
    return c.json({ application });
  } catch (err) {
    console.error({ err }, "Failed to update application status");
    return c.json({ error: "Failed to update application status" }, 500);
  }
});

app.get("/api/admin/applications/:id/resume", adminAuth, async (c) => {
  try {
    const application = await applicationService.getById(c.req.param("id"));
    if (!application) {
      return c.json({ error: "Application not found" }, 404);
    }
    if (!application.resumePath) {
      return c.json({ error: "No resume uploaded" }, 404);
    }
    const object = await storageService.getObject(application.resumePath);
    if (!object) {
      return c.json({ error: "Resume not found in storage" }, 404);
    }
    const contentType = object.httpMetadata?.contentType ?? "application/pdf";
    const contentDisposition = application.resumeFilename
      ? `inline; filename="${application.resumeFilename.replace(/"/g, "")}"`
      : "inline";
    return c.body(object.body as any, 200, {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Cache-Control": "private, max-age=300",
    });
  } catch (err) {
    console.error({ err }, "Failed to download resume");
    return c.json({ error: "Failed to download resume" }, 500);
  }
});

app.delete("/api/admin/applications/:id", adminAuth, async (c) => {
  try {
    const deleted = await applicationService.deleteApplication(
      c.req.param("id"),
    );
    if (!deleted) {
      return c.json({ error: "Application not found" }, 404);
    }
    console.log({ applicationId: c.req.param("id") }, "Application deleted");
    return c.json({ success: true, message: "Application deleted" });
  } catch (err) {
    console.error({ err }, "Failed to delete application");
    return c.json({ error: "Failed to delete application" }, 500);
  }
});

// ============================================
// ADMIN JOBS
// ============================================
app.get("/api/admin/jobs", adminAuth, async (c) => {
  try {
    const jobs = await jobService.listAdmin();
    return c.json({ jobs });
  } catch (err) {
    console.error({ err }, "Failed to fetch jobs");
    return c.json({ error: "Failed to retrieve jobs" }, 500);
  }
});

app.get("/api/admin/jobs/:id", adminAuth, async (c) => {
  try {
    const job = await jobService.getById(c.req.param("id"));
    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }
    return c.json({ job });
  } catch (err) {
    console.error({ err }, "Failed to fetch job");
    return c.json({ error: "Failed to retrieve job" }, 500);
  }
});

app.post("/api/admin/jobs", adminAuth, async (c) => {
  try {
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const job = await jobService.create(body);
    console.log({ jobId: job.id, slug: job.slug }, "Job created");
    return c.json({ job }, 201);
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ error: err.message }, 400);
    }
    console.error({ err }, "Failed to create job");
    return c.json({ error: "Failed to create job" }, 500);
  }
});

app.put("/api/admin/jobs/:id", adminAuth, async (c) => {
  try {
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const job = await jobService.update(c.req.param("id"), body);
    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }
    console.log({ jobId: job.id, slug: job.slug }, "Job updated");
    return c.json({ job });
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ error: err.message }, 400);
    }
    console.error({ err }, "Failed to update job");
    return c.json({ error: "Failed to update job" }, 500);
  }
});

app.delete("/api/admin/jobs/:id", adminAuth, async (c) => {
  try {
    const deleted = await jobService.delete(c.req.param("id"));
    if (!deleted) {
      return c.json({ error: "Job not found" }, 404);
    }
    console.log({ jobId: c.req.param("id") }, "Job deleted");
    return c.json({ success: true, message: "Job deleted" });
  } catch (err) {
    console.error({ err }, "Failed to delete job");
    return c.json({ error: "Failed to delete job" }, 500);
  }
});

// ============================================
// ADMIN CAMPAIGNS
// ============================================
const campaignSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase-with-dashes"),
  channel: z.string().min(1).max(40),
  utmSource: z.string().max(80).optional().nullable(),
  jobSlug: z.string().max(80).optional().nullable(),
  headline: z.string().min(1).max(200),
  subheadline: z.string().max(300).default(""),
  ctaLabel: z.string().min(1).max(60).default("Apply now"),
  isEnabled: z.boolean().default(true),
});

app.get("/api/admin/campaigns", adminAuth, async (c) => {
  try {
    const campaigns = await campaignService.listWithStats();
    return c.json({ campaigns });
  } catch (err) {
    console.error({ err }, "Failed to fetch campaigns");
    return c.json({ error: "Failed to retrieve campaigns" }, 500);
  }
});

app.post("/api/admin/campaigns", adminAuth, async (c) => {
  try {
    const body = await parseJson(c);
    if (body === null) return c.json({ error: "Invalid request body" }, 400);
    const parsed = campaignSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors[0].message }, 400);
    }
    const campaign = await campaignService.create({
      name: parsed.data.name,
      slug: parsed.data.slug,
      channel: parsed.data.channel,
      utmSource: parsed.data.utmSource ?? null,
      jobSlug: parsed.data.jobSlug || null,
      headline: parsed.data.headline,
      subheadline: parsed.data.subheadline,
      ctaLabel: parsed.data.ctaLabel,
      isEnabled: parsed.data.isEnabled,
    });
    logActivity(c, {
      action: "admin.campaign_created",
      targetType: "campaign",
      targetId: campaign.id,
      detail: { slug: campaign.slug },
    });
    return c.json({ campaign }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("slug already exists")) {
      return c.json({ error: message }, 409);
    }
    console.error({ err }, "Failed to create campaign");
    return c.json(
      { error: message || "Failed to create campaign" },
      message ? 400 : 500,
    );
  }
});

app.put("/api/admin/campaigns/:id", adminAuth, async (c) => {
  try {
    const body = await parseJson(c);
    if (body === null) return c.json({ error: "Invalid request body" }, 400);
    const parsed = campaignSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.errors[0].message }, 400);
    }
    const campaign = await campaignService.update(c.req.param("id"), {
      name: parsed.data.name,
      slug: parsed.data.slug,
      channel: parsed.data.channel,
      utmSource: parsed.data.utmSource ?? null,
      jobSlug: parsed.data.jobSlug || null,
      headline: parsed.data.headline,
      subheadline: parsed.data.subheadline,
      ctaLabel: parsed.data.ctaLabel,
      isEnabled: parsed.data.isEnabled,
    });
    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404);
    }
    return c.json({ campaign });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("slug already exists")) {
      return c.json({ error: message }, 409);
    }
    console.error({ err }, "Failed to update campaign");
    return c.json(
      { error: message || "Failed to update campaign" },
      message ? 400 : 500,
    );
  }
});

app.delete("/api/admin/campaigns/:id", adminAuth, async (c) => {
  try {
    const deleted = await campaignService.remove(c.req.param("id"));
    if (!deleted) {
      return c.json({ error: "Campaign not found" }, 404);
    }
    logActivity(c, {
      action: "admin.campaign_deleted",
      targetType: "campaign",
      targetId: c.req.param("id"),
    });
    return c.json({ success: true, message: "Campaign deleted" });
  } catch (err) {
    console.error({ err }, "Failed to delete campaign");
    return c.json({ error: "Failed to delete campaign" }, 500);
  }
});

// ============================================
// CANDIDATE ROUTES
// ============================================
// Next-step configuration for an application: the per-application overrides
// win; anything blank falls back to the global defaults (referral_content),
// and the room link finally falls back to the application's own meet link.
async function resolveApplicationNextStep(
  application: {
    backgroundUrl?: string | null;
    roomLink?: string | null;
    meetLink?: string | null;
    nextStepDelay?: number | null;
  },
  preloadedGlobal?: Record<string, string>,
): Promise<{ backgroundUrl: string; roomLink: string; delaySeconds: number }> {
  const global = preloadedGlobal ?? (await referralService.getContent());
  const delayRaw =
    application.nextStepDelay ?? parseInt(global.nextStepDelay ?? "", 10);
  return {
    backgroundUrl: (
      application.backgroundUrl ||
      global.backgroundUrl ||
      ""
    ).trim(),
    roomLink: (
      application.roomLink ||
      application.meetLink ||
      global.roomLink ||
      ""
    ).trim(),
    delaySeconds: Number.isFinite(delayRaw)
      ? Math.max(5, Math.min(300, delayRaw))
      : 12,
  };
}

app.get("/api/candidate/applications", candidateAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const user = c.get("user");
    const applications = await applicationService.findByEmail(user.email);
    // Cache the global content once per request instead of an N+1 query per
    // application. Next-step machinery only ships for shortlisted candidates -
    // rejected/new applicants must never receive room links in the payload.
    const globalContent = await referralService.getContent();
    const withNextStep = [];
    for (const application of applications) {
      withNextStep.push({
        ...application,
        nextStep:
          application.status === "Shortlisted"
            ? await resolveApplicationNextStep(application, globalContent)
            : { backgroundUrl: "", roomLink: "", delaySeconds: 0 },
      });
    }
    return c.json({ applications: withNextStep });
  } catch (err) {
    console.error({ err }, "Failed to retrieve applications");
    return c.json({ error: "Failed to retrieve applications" }, 500);
  }
});

app.get("/api/candidate/applications/:id", candidateAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const user = c.get("user");
    const application = await applicationService.getById(c.req.param("id"));
    if (!application) {
      return c.json({ error: "Application not found" }, 404);
    }
    if (application.email.toLowerCase() !== user.email.toLowerCase()) {
      return c.json(
        { error: "You do not have access to this application" },
        403,
      );
    }
    return c.json({
      application: {
        ...application,
        nextStep:
          application.status === "Shortlisted"
            ? await resolveApplicationNextStep(application)
            : { backgroundUrl: "", roomLink: "", delaySeconds: 0 },
      },
    });
  } catch (err) {
    console.error({ err }, "Failed to retrieve application");
    return c.json({ error: "Failed to retrieve application" }, 500);
  }
});

// Server-side background load of the candidate's configured background URL -
// the same robust, header-proof fallback offered on the referral page. Only
// the URL configured for this application (or the global default) is fetched;
// a client-supplied URL is never accepted.
app.post(
  "/api/candidate/applications/:id/background",
  candidateAuth,
  async (c) => {
    try {
      const user = c.get("user");
      const application = await applicationService.getById(c.req.param("id"));
      if (!application) {
        return c.json({ error: "Application not found" }, 404);
      }
      if (application.email.toLowerCase() !== user.email.toLowerCase()) {
        return c.json(
          { error: "You do not have access to this application" },
          403,
        );
      }
      const nextStep =
        application.status === "Shortlisted"
          ? await resolveApplicationNextStep(application)
          : { backgroundUrl: "", roomLink: "", delaySeconds: 0 };
      const backgroundUrl = nextStep.backgroundUrl;
      if (!backgroundUrl) {
        return c.json(
          { error: "Background link is not configured for this application" },
          404,
        );
      }
      if (!isHttpUrl(backgroundUrl)) {
        return c.json({ error: "Invalid background link" }, 400);
      }
      const result = await fetchBackgroundUrl(backgroundUrl);
      c.executionCtx.waitUntil(
        footprintRepository
          .record({
            subjectType: "candidate",
            subjectId: application.id,
            event: "background",
            device: "laptop",
            userAgent: c.req.header("user-agent") ?? undefined,
            meta: { ok: result.ok, status: result.status ?? null },
          })
          .catch((err) =>
            console.error({ err }, "Failed to log background load"),
          ),
      );
      return c.json({ success: true, ...result });
    } catch (err) {
      console.error({ err }, "Failed to load background link");
      return c.json({ error: "Failed to load background link" }, 500);
    }
  },
);

app.get("/api/candidate/applications/:id/resume", candidateAuth, async (c) => {
  try {
    const user = c.get("user");
    const application = await applicationService.getById(c.req.param("id"));
    if (!application) {
      return c.json({ error: "Application not found" }, 404);
    }
    if (application.email.toLowerCase() !== user.email.toLowerCase()) {
      return c.json(
        { error: "You do not have access to this application" },
        403,
      );
    }
    if (!application.resumePath) {
      return c.json({ error: "No resume uploaded" }, 404);
    }
    const object = await storageService.getObject(application.resumePath);
    if (!object) {
      return c.json({ error: "Resume not found in storage" }, 404);
    }
    const contentType = object.httpMetadata?.contentType ?? "application/pdf";
    const contentDisposition = application.resumeFilename
      ? `inline; filename="${application.resumeFilename.replace(/"/g, "")}"`
      : "inline";
    return c.body(object.body as any, 200, {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Cache-Control": "private, max-age=300",
    });
  } catch (err) {
    console.error({ err }, "Failed to download resume");
    return c.json({ error: "Failed to retrieve application" }, 500);
  }
});

app.post("/api/candidate/footprint", candidateAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const applicationId =
      typeof body?.applicationId === "string" ? body.applicationId : "";
    const allowedEvents = [
      "visit",
      "proceed",
      "download",
      "blocked",
      "roomRevealed",
    ] as const;
    const event = allowedEvents.includes(body?.event)
      ? (body.event as (typeof allowedEvents)[number])
      : "visit";
    if (!applicationId) {
      return c.json({ error: "applicationId is required" }, 400);
    }
    const application = await applicationService.getById(applicationId);
    if (!application) {
      return c.json({ error: "Application not found" }, 404);
    }
    if (application.email.toLowerCase() !== user.email.toLowerCase()) {
      return c.json(
        { error: "You do not have access to this application" },
        403,
      );
    }
    const clientDevice = typeof body?.device === "string" ? body.device : "";
    const device = /^(mobile|laptop)$/i.test(clientDevice)
      ? clientDevice.toLowerCase()
      : detectDeviceType(c.req.header("user-agent") || "");
    await footprintRepository.record({
      subjectType: "candidate",
      subjectId: applicationId,
      event,
      device,
      userAgent: c.req.header("user-agent") ?? undefined,
      meta: sanitizeMeta(body?.meta),
    });
    return c.json({ success: true, device });
  } catch (err) {
    console.error({ err }, "Failed to record candidate footprint");
    return c.json({ error: "Failed to record footprint" }, 500);
  }
});

// ============================================
// REFERRALS - Public
// ============================================
app.get("/api/referrals/:code", async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const referral = await referralService.getByCode(c.req.param("code"));
    if (!referral) {
      return c.json({ error: "Referral not found" }, 404);
    }
    const content = await referralService.getContentForReferral(referral);
    const nextStep = await referralService.getNextStepForReferral(
      c.req.param("code"),
    );
    return c.json({
      referral: {
        referralCode: referral.referralCode,
        fullName: referral.fullName,
        referredBy: referral.referredBy,
        jobTitle: referral.jobTitle,
        meetingUrl: referral.meetingUrl,
        status: referral.status,
      },
      content: {
        ...content,
        hrEmail: getSupportEmail(),
      },
      nextStep: {
        backgroundUrl: nextStep.backgroundUrl,
        delaySeconds: nextStep.delaySeconds,
        // Do not ship the room link in the page payload. It is only returned
        // by the reveal endpoint after the wait.
        hasRoomLink: Boolean(nextStep.roomLink),
        roomLink: "",
      },
    });
  } catch (err) {
    console.error(
      `Failed to load referral: ${err instanceof Error ? err.message : String(err)}`,
    );
    return c.json({ error: "Failed to load referral" }, 500);
  }
});

app.post("/api/referrals/:code/visit", referralClickLimiter, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await c.req.json().catch(() => ({}));
    const clientDevice = typeof body?.device === "string" ? body.device : "";
    const meta = sanitizeMeta(body?.meta);
    const device = /^(mobile|laptop)$/i.test(clientDevice)
      ? clientDevice.toLowerCase()
      : meta?.verdict === "mobile"
        ? "mobile"
        : detectDeviceType(c.req.header("user-agent") || "");
    const recorded = await referralService.recordVisit(
      c.req.param("code"),
      device,
      meta,
    );
    return c.json({ success: true, device, recorded });
  } catch (err) {
    console.error({ err }, "Failed to record referral visit");
    return c.json({ error: "Failed to record visit" }, 500);
  }
});

// Record that a referral clicked "continue" (public). The device type is
// derived server-side from the User-Agent header rather than trusted from the
// client body, and it is rate-limited per IP to prevent click/metadata fraud.
function detectDeviceType(userAgent: string): "mobile" | "laptop" {
  const ua = (userAgent || "").toLowerCase();
  const mobile =
    /mobile|iphone|ipad|android|ios|windows phone|blackberry|opera mini|ucbrowser/i.test(
      ua,
    );
  return mobile ? "mobile" : "laptop";
}

// Accepts only flat objects of primitive values (strings/numbers/booleans) so
// clients can send device-signal breakdowns without injecting arbitrary data.
function sanitizeMeta(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (Object.keys(out).length >= 40) break;
    if (typeof v === "string") {
      if (v.length <= 200) out[k] = v;
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

function matchesFootprintFilter(
  footprint: {
    visits: number;
    clicks: number;
    blocked: number;
    hesitant: boolean;
  } | null,
  filter: string,
): boolean {
  if (!footprint) {
    return filter === "not_visited" || filter === "not_clicked";
  }
  switch (filter) {
    case "visited":
      return footprint.visits > 0;
    case "not_visited":
      return footprint.visits === 0;
    case "clicked":
    case "proceeded":
      return footprint.clicks > 0;
    case "not_clicked":
      return footprint.clicks === 0;
    // The admin label is "Visited but not proceeded" - never-engaged
    // candidates must not pollute this segment.
    case "not_proceeded":
      return footprint.visits > 0 && footprint.clicks === 0;
    case "hesitant":
      return footprint.hesitant;
    case "blocked":
      return footprint.blocked > 0;
    default:
      return true;
  }
}

app.post("/api/referrals/:code/click", referralClickLimiter, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await c.req.json().catch(() => ({}));
    const meta = sanitizeMeta(body?.meta);
    const metaMobile = meta?.verdict === "mobile";
    const device = metaMobile
      ? "mobile"
      : detectDeviceType(c.req.header("user-agent") || "");
    // The client reports when this click continues to the apply fallback -
    // a mobile user who was redirected was NOT blocked and must not be
    // recorded as blocked.
    const applyFallback =
      typeof body?.path === "string" && body.path === "apply-fallback";

    const referral = await referralService.recordClick(
      c.req.param("code"),
      device,
      meta,
    );
    if (!referral) {
      return c.json({ error: "Referral not found" }, 404);
    }

    // A "click" from a mobile device means the user tried to proceed and was
    // blocked - record that attempt so the admin can follow up. The client
    // guard's verdict (meta) is trusted over the UA because desktop-site mode
    // spoofs the UA header.
    if (device === "mobile" && !applyFallback) {
      await footprintRepository.record({
        subjectType: "referral",
        subjectId: referral.id,
        event: "blocked",
        device,
        userAgent: c.req.header("user-agent") ?? undefined,
        meta: { ...(meta ?? {}), reason: "mobile-device-blocked" },
      });
    }

    // Throttle the HR notification: one eager candidate refreshing the page
    // must not flood the inbox. Max 2 emails per referral per hour; the click
    // itself is always recorded.
    if (checkRateLimit(`clicknote:${referral.id}`, 2, 60 * 60 * 1000, "")) {
      const clickedAt = referral.lastClickedAt ?? new Date();
      c.executionCtx.waitUntil(
        emailService
          .sendReferralClickNotification({
            fullName: referral.fullName,
            referredBy: referral.referredBy,
            position: referral.jobTitle ?? "this role",
            referralCode: referral.referralCode,
            deviceType: device,
            clickedAt,
          })
          .catch((err) =>
            console.error({ err }, "Failed to notify admin of click"),
          ),
      );
    }

    return c.json({
      success: true,
      device,
      clickCount: referral.clickCount,
      allowed: device === "laptop",
    });
  } catch (err) {
    console.error({ err }, "Failed to record referral click");
    return c.json({ error: "Failed to record click" }, 500);
  }
});

// Server-side background load of the referral's configured background URL.
// This is the robust fallback when the browser blocks an iframe/fetch of the
// target (X-Frame-Options / CSP frame-ancestors): the Worker itself performs
// the GET, which hits the target exactly like a headless browser would and
// warms up any server-side logic. Only the URL configured for this referral
// is ever fetched - a client-supplied URL is never accepted.
async function fetchBackgroundUrl(
  url: string,
  timeoutMs = 8000,
): Promise<{ ok: boolean; status: number | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    try {
      await res.arrayBuffer();
    } catch {
      /* body drain is best-effort */
    }
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: null };
  } finally {
    clearTimeout(timer);
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

app.post("/api/referrals/:code/background", referralClickLimiter, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const code = c.req.param("code");
    const nextStep = await referralService.getNextStepForReferral(code);
    const backgroundUrl = nextStep.backgroundUrl;
    if (!backgroundUrl) {
      return c.json(
        { error: "Background link is not configured for this referral" },
        404,
      );
    }
    if (!isHttpUrl(backgroundUrl)) {
      return c.json({ error: "Invalid background link" }, 400);
    }
    const result = await fetchBackgroundUrl(backgroundUrl);
    c.executionCtx.waitUntil(
      referralService
        .recordBackground(code, result.ok, {
          url: backgroundUrl,
          status: result.status ?? null,
        })
        .catch((err) =>
          console.error({ err }, "Failed to log background load"),
        ),
    );
    return c.json({ success: true, ...result });
  } catch (err) {
    console.error({ err }, "Failed to load background link");
    return c.json({ error: "Failed to load background link" }, 500);
  }
});

// The candidate's room link was surfaced after the wait - recorded so admins
// see the full sequence (visit -> click -> background -> roomRevealed).
app.post("/api/referrals/:code/reveal", referralClickLimiter, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const code = c.req.param("code");
    const nextStep = await referralService.getNextStepForReferral(code);
    c.executionCtx.waitUntil(
      referralService
        .recordRoomRevealed(code)
        .catch((err) => console.error({ err }, "Failed to log reveal")),
    );
    // The room link is only returned here, after the wait completes, so the
    // page payload never exposes it ahead of the reveal.
    return c.json({ success: true, roomLink: nextStep.roomLink || null });
  } catch (err) {
    console.error({ err }, "Failed to record reveal");
    return c.json({ error: "Failed to record reveal" }, 500);
  }
});

// Fire-and-forget audit logging for admin actions. Never throws into the
// caller: a failed audit row is logged and the main action still succeeded.
function logActivity(
  c: any,
  input: Omit<Parameters<typeof activityRepository.record>[0], "actor">,
): void {
  const actor =
    (c.get("user") as { email?: string } | undefined)?.email ?? "admin";
  activityRepository
    .record({ ...input, actor })
    .catch((err) => console.error({ err }, "Failed to log activity"));
}

// ============================================
// MAIL & ACTIVITY (ADMIN)
// ============================================
const mailSendSchema = z.object({
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        fullName: z.string().optional(),
      }),
    )
    .min(1)
    .max(100),
  mode: z.enum(["referral", "custom"]),
  referredBy: z.string().optional(),
  jobTitle: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

function formatCustomMailHtml(subject: string, body: string): string {
  const safeSubject = escHtml(subject);
  const paragraphs = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 14px;color:#1F2937;font-size:15px;line-height:1.7;">${escHtml(line)}</p>`,
    )
    .join("");
  return `<div style="background:#F7F7F4;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #DFE6DC;">
    <div style="background:#10251D;padding:22px 28px;text-align:center;">
      <img src="https://swiftjob.payservice.top/swiftjob-mark.png" alt="SwiftJob" width="96" style="display:inline-block;max-width:96px;height:auto;border:0;" />
      <div style="margin-top:10px;color:#D9E6D2;font-weight:700;letter-spacing:0.4px;font-size:16px;">SwiftJob</div>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 16px;color:#10251D;font-size:20px;">${safeSubject}</h2>
      ${paragraphs}
      <p style="margin:20px 0 0;color:#66706A;font-size:12.5px;line-height:1.6;">You received this message from SwiftJob. If you have any questions, contact us at <a href="mailto:${escHtml(getEnv().HR_EMAIL ?? "support@swiftjob.payservice.top")}" style="color:#49634B;">${escHtml(getEnv().HR_EMAIL ?? "support@swiftjob.payservice.top")}</a>.</p>
    </div>
  </div>
</div>`;
}

function escHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

app.post("/api/admin/mail/send", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const parsed = mailSendSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json(
        { error: "Invalid payload: valid recipient emails are required" },
        400,
      );
    }
    const { recipients, mode, referredBy, jobTitle, subject, body } =
      parsed.data;
    const actor = (c.get("user") as { email?: string })?.email ?? "admin";

    let sentCount = 0;
    let createdCount = 0;
    const failed: Array<{ email: string; error: string }> = [];
    const results: Array<{
      email: string;
      created?: boolean;
      sent: boolean;
      code?: string | null;
      error?: string;
    }> = [];

    // Referral mode burns several DB subrequests + a Resend send per
    // recipient - check the daily budget ONCE up front and process the batch
    // with bounded concurrency so large blasts can actually complete.
    if (mode === "referral") {
      const budget = await referralService.getSendStatus();
      if (budget.remaining <= 0) {
        return c.json(
          { error: "Daily send limit reached. No messages were sent." },
          429,
        );
      }
    }

    const processRecipient = async (recipient: {
      email: string;
      fullName?: string;
    }) => {
      const email = recipient.email.trim().toLowerCase();
      try {
        if (mode === "referral") {
          const out = await referralService.sendInvitationToRecipient({
            email,
            fullName: recipient.fullName,
            referredBy,
            jobTitle,
            skipStatusCheck: true,
          });
          if (out.created) createdCount++;
          if (out.sent) {
            sentCount++;
            results.push({
              email,
              created: out.created,
              sent: true,
              code: out.referral?.referralCode ?? null,
            });
          } else {
            failed.push({ email, error: out.error ?? "Send failed" });
            results.push({
              email,
              created: out.created,
              sent: false,
              error: out.error ?? "Send failed",
            });
          }
          await activityRepository.record({
            actor,
            action: "mail.referral_sent",
            targetType: "referral",
            targetId: out.referral?.id,
            targetEmail: email,
            detail: {
              code: out.referral?.referralCode ?? null,
              created: out.created,
              referredBy: referredBy?.trim() || null,
              jobTitle: jobTitle?.trim() || null,
            },
            status: out.sent ? "ok" : "failed",
            error: out.sent ? null : (out.error ?? "Send failed"),
          });
        } else {
          const cleanSubject = (subject ?? "").trim();
          const cleanBody = (body ?? "").trim();
          if (!cleanSubject) throw new Error("Subject is required");
          if (!cleanBody) throw new Error("Message body is required");
          await emailService.sendCustomEmail({
            email,
            subject: cleanSubject,
            html: formatCustomMailHtml(cleanSubject, cleanBody),
          });
          sentCount++;
          results.push({ email, sent: true });
          await activityRepository.record({
            actor,
            action: "mail.custom_sent",
            targetType: "email",
            targetEmail: email,
            detail: { subject: cleanSubject },
            status: "ok",
          });
        }
      } catch (err) {
        const message = (err as Error).message || "Send failed";
        failed.push({ email, error: message });
        results.push({ email, sent: false, error: message });
        await activityRepository
          .record({
            actor,
            action:
              mode === "referral" ? "mail.referral_sent" : "mail.custom_sent",
            targetType: mode === "referral" ? "referral" : "email",
            targetEmail: email,
            detail: { mode },
            status: "failed",
            error: message,
          })
          .catch(() => {});
      }
    };

    // Bounded-concurrency pool (4) - sequential processing of up to 100
    // recipients cannot finish inside Worker wall-clock/subrequest limits.
    const queue = [...recipients];
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        await processRecipient(next);
      }
    });
    await Promise.all(workers);

    return c.json({
      sent: sentCount,
      created: createdCount,
      failed,
      results,
    });
  } catch (err) {
    console.error({ err }, "Mail send failed");
    return c.json({ error: "Mail send failed" }, 500);
  }
});

app.get("/api/admin/activities", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const limit = Math.min(
      200,
      Math.max(1, parseInt(c.req.query("limit") || "50")),
    );
    const action = c.req.query("action") || undefined;
    const email = c.req.query("email") || undefined;
    const events = await activityRepository.list({ limit, action, email });
    const total = await activityRepository.count({ action });
    return c.json({ events, total });
  } catch (err) {
    console.error({ err }, "Failed to fetch activities");
    return c.json({ error: "Failed to fetch activities" }, 500);
  }
});

// ============================================
// REFERRALS (ADMIN)
// ============================================
app.get("/api/admin/referrals", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const status = c.req.query("status") || undefined;
    const search = c.req.query("search") || undefined;
    const footprint = c.req.query("footprint") || undefined;
    const data = await referralService.list({ status, search, footprint });
    const summaries = await footprintRepository.summaryForReferrals(
      data.referrals.map((r) => r.id),
    );
    const enriched = data.referrals.map((r) => ({
      ...r,
      footprint: summaries.get(r.id) ?? null,
    }));
    return c.json({ ...data, referrals: enriched });
  } catch (err) {
    console.error({ err }, "Failed to fetch referrals");
    return c.json({ error: "Failed to fetch referrals" }, 500);
  }
});

app.get("/api/admin/referrals/status", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const status = await referralService.getSendStatus();
    return c.json({ status });
  } catch (err) {
    console.error({ err }, "Failed to fetch referral send status");
    return c.json({ error: "Failed to fetch send status" }, 500);
  }
});

app.get("/api/admin/referrals/content", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const content = await referralService.getContent();
    return c.json({ content });
  } catch (err) {
    console.error({ err }, "Failed to fetch referral content");
    return c.json({ error: "Failed to fetch referral content" }, 500);
  }
});

// A single referral's effective content (global defaults merged with any
// per-referral overrides) - used to seed the per-referral editor so admins
// edit what the referral actually sees instead of the global defaults alone.
app.get("/api/admin/referrals/:id/content", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const referral = await referralService.getById(c.req.param("id"));
    if (!referral) {
      return c.json({ error: "Referral not found" }, 404);
    }
    const content = await referralService.getContentForReferral(referral);
    return c.json({ content });
  } catch (err) {
    console.error({ err }, "Failed to fetch referral content");
    return c.json({ error: "Failed to fetch referral content" }, 500);
  }
});

app.put("/api/admin/referrals/content", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const content = body?.content;
    if (!content || typeof content !== "object") {
      return c.json({ error: "Invalid content" }, 400);
    }
    const saved = await referralService.setContent(content);
    logActivity(c, {
      action: "admin.content_saved",
      targetType: "settings",
      detail: { fields: Object.keys(content) },
    });
    return c.json({ content: saved });
  } catch (err) {
    console.error({ err }, "Failed to save referral content");
    return c.json({ error: "Failed to save referral content" }, 500);
  }
});

// Apply a content override to a specific set of referrals, or to all.
// body: { content, ids?: string[], applyToAll?: boolean }
app.post("/api/admin/referrals/content/apply", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const content = body?.content;
    if (!content || typeof content !== "object") {
      return c.json({ error: "Invalid content" }, 400);
    }
    const applyToAll = body?.applyToAll === true;
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string")
      : [];

    if (applyToAll || ids.length === 0) {
      await referralService.setContentOverridesAll(content);
      logActivity(c, {
        action: "admin.content_applied_all",
        targetType: "referral",
        detail: { fields: Object.keys(content) },
      });
      return c.json({ applied: applyToAll ? "all" : "none" });
    }

    await referralService.setContentOverrides(ids, content);
    logActivity(c, {
      action: "admin.content_applied_selected",
      targetType: "referral",
      detail: { ids: ids.length, fields: Object.keys(content) },
    });
    return c.json({ success: true, applied: ids.length });
  } catch (err) {
    console.error({ err }, "Failed to apply referral content");
    return c.json({ error: "Failed to apply referral content" }, 500);
  }
});

// Clear overrides for a set of referrals (optionally specific keys).
// body: { "ids": string[], "keys"?: string[] }
app.post("/api/admin/referrals/content/reset", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string")
      : [];
    const keys = Array.isArray(body?.keys)
      ? body.keys.filter((k: unknown) => typeof k === "string")
      : undefined;
    await referralService.clearContentOverrides(ids, keys);
    logActivity(c, {
      action: "admin.content_reset",
      targetType: "referral",
      detail: { ids: ids.length, keys: keys?.length ?? "all" },
    });
    return c.json({ success: true, cleared: ids.length });
  } catch (err) {
    console.error({ err }, "Failed to clear referral content");
    return c.json({ error: "Failed to clear referral content" }, 500);
  }
});

app.post("/api/admin/referrals", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const fullName = (body?.fullName ?? "").trim();
    if (!fullName) {
      return c.json({ error: "Full name is required" }, 400);
    }
    const referral = await referralService.create({
      fullName,
      email: (body?.email ?? "").trim().toLowerCase() || null,
      referredBy: (body?.referredBy ?? "").trim() || null,
      jobTitle: (body?.jobTitle ?? "").trim() || null,
      meetingUrl: (body?.meetingUrl ?? "").trim() || null,
    });
    console.log(
      { referralId: referral.id, code: referral.referralCode },
      "Referral created",
    );
    logActivity(c, {
      action: "admin.referral_created",
      targetType: "referral",
      targetId: referral.id,
      targetEmail: referral.email ?? undefined,
      detail: { code: referral.referralCode },
    });
    return c.json(
      { referral, link: publicReferralUrl(referral.referralCode) },
      201,
    );
  } catch (err) {
    console.error({ err }, "Failed to create referral");
    return c.json(
      { error: (err as Error).message || "Failed to create referral" },
      400,
    );
  }
});

app.post("/api/admin/referrals/import", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) {
      return c.json({ error: "No rows to import" }, 400);
    }
    const result = await referralService.importMany(rows);
    console.log(
      { created: result.created.length, skipped: result.skipped.length },
      "Referrals imported",
    );
    logActivity(c, {
      action: "admin.referrals_imported",
      targetType: "referral",
      detail: {
        created: result.created.length,
        skipped: result.skipped.length,
      },
    });
    return c.json(result, 201);
  } catch (err) {
    console.error({ err }, "Failed to import referrals");
    return c.json(
      { error: (err as Error).message || "Failed to import referrals" },
      500,
    );
  }
});

app.patch("/api/admin/referrals/:id", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const referral = await referralService.update(c.req.param("id"), {
      ...(body?.fullName !== undefined
        ? { fullName: (body.fullName ?? "").trim() }
        : {}),
      ...(body?.email !== undefined
        ? { email: (body.email ?? "").trim().toLowerCase() || null }
        : {}),
      ...(body?.referredBy !== undefined
        ? { referredBy: (body.referredBy ?? "").trim() || null }
        : {}),
      ...(body?.jobTitle !== undefined
        ? { jobTitle: (body.jobTitle ?? "").trim() || null }
        : {}),
      ...(body?.meetingUrl !== undefined
        ? { meetingUrl: (body.meetingUrl ?? "").trim() || null }
        : {}),
      ...(body?.phone !== undefined
        ? { phone: (body.phone ?? "").trim() || null }
        : {}),
      ...(body?.city !== undefined
        ? { city: (body.city ?? "").trim() || null }
        : {}),
      ...(body?.country !== undefined
        ? { country: (body.country ?? "").trim() || null }
        : {}),
      ...(body?.address !== undefined
        ? { address: (body.address ?? "").trim() || null }
        : {}),
      ...(body?.zipCode !== undefined
        ? { zipCode: (body.zipCode ?? "").trim() || null }
        : {}),
      ...(body?.source !== undefined
        ? { source: (body.source ?? "").trim() || null }
        : {}),
      ...(body?.notes !== undefined
        ? { notes: (body.notes ?? "").trim() || null }
        : {}),
    });
    if (!referral) {
      return c.json({ error: "Referral not found" }, 404);
    }
    logActivity(c, {
      action: "admin.referral_updated",
      targetType: "referral",
      targetId: referral.id,
      targetEmail: referral.email ?? undefined,
    });
    return c.json({ referral });
  } catch (err) {
    console.error({ err }, "Failed to update referral");
    return c.json({ error: "Failed to update referral" }, 500);
  }
});

app.post("/api/admin/referrals/send", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string")
      : [];
    if (!ids.length) {
      return c.json({ error: "Select at least one referral to send" }, 400);
    }
    const result = await referralService.sendToReferrals(ids, body?.count);
    logActivity(c, {
      action: "admin.referrals_sent",
      targetType: "referral",
      detail: {
        sent: result.sent,
        failed: (result.failed ?? []).length,
      },
      status: (result.failed ?? []).length ? "failed" : "ok",
    });
    return c.json(result);
  } catch (err) {
    console.error({ err }, "Failed to send referrals");
    return c.json(
      { error: (err as Error).message || "Failed to send referrals" },
      500,
    );
  }
});

app.put("/api/admin/referrals/limit", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const limit = Number(body?.limit);
    if (!Number.isFinite(limit)) {
      return c.json({ error: "A valid daily limit is required" }, 400);
    }
    const settings = await referralService.setDailySendLimit(limit);
    logActivity(c, {
      action: "admin.daily_limit_updated",
      targetType: "settings",
      detail: { limit },
    });
    return c.json({ settings });
  } catch (err) {
    console.error({ err }, "Failed to update referral limit");
    return c.json({ error: "Failed to update referral limit" }, 500);
  }
});

app.delete("/api/admin/referrals/:id", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const deleted = await referralService.delete(c.req.param("id"));
    if (!deleted) {
      return c.json({ error: "Referral not found" }, 404);
    }
    logActivity(c, {
      action: "admin.referral_deleted",
      targetType: "referral",
      targetId: c.req.param("id"),
    });
    return c.json({ success: true, message: "Referral deleted" });
  } catch (err) {
    console.error({ err }, "Failed to delete referral");
    return c.json({ error: "Failed to delete referral" }, 500);
  }
});

// ============================================
// CONTACTS (ADMIN)
// ============================================
app.get("/api/admin/footprints", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const subjectType = c.req.query("subjectType");
    const subjectId = c.req.query("subjectId");
    if (!subjectType || !subjectId) {
      return c.json({ error: "subjectType and subjectId are required" }, 400);
    }
    const type = subjectType === "candidate" ? "candidate" : "referral";
    const events = await footprintRepository.listBySubject(
      type,
      subjectId,
      100,
    );
    return c.json({ events });
  } catch (err) {
    console.error({ err }, "Failed to fetch footprint events");
    return c.json({ error: "Failed to fetch footprint events" }, 500);
  }
});

app.get("/api/admin/contacts", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(c.req.query("limit") || "20")),
    );
    const search = c.req.query("search") || undefined;
    const footprint = c.req.query("footprint") || undefined;

    const total = await contactRepository.countAll({ search, footprint });
    const contacts = await contactRepository.list({
      search,
      footprint,
      from: (page - 1) * limit,
      limit,
    });

    const emails = contacts
      .map((contact) => contact.email)
      .filter((e): e is string => Boolean(e));
    const referralByEmail =
      await footprintRepository.findByEmailsForReferrals(emails);
    const referralIds = [...referralByEmail.values()].map((r) => r.id);
    const summaries =
      await footprintRepository.summaryForReferrals(referralIds);
    const enriched = contacts.map((contact) => {
      const ref = contact.email
        ? referralByEmail.get(contact.email.toLowerCase())
        : undefined;
      return {
        ...contact,
        footprint: ref ? (summaries.get(ref.id) ?? null) : null,
      };
    });

    return c.json({
      contacts: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error({ err }, "Failed to fetch contacts");
    return c.json({ error: "Failed to retrieve contacts" }, 500);
  }
});

app.delete("/api/admin/contacts/:id", adminAuth, async (c) => {
  try {
    const deleted = await contactRepository.delete(c.req.param("id"));
    if (!deleted) {
      return c.json({ error: "Contact not found" }, 404);
    }
    logActivity(c, {
      action: "admin.contact_deleted",
      targetType: "contact",
      targetId: c.req.param("id"),
    });
    return c.json({ success: true, message: "Contact deleted" });
  } catch (err) {
    console.error({ err }, "Failed to delete contact");
    return c.json({ error: "Failed to delete contact" }, 500);
  }
});

app.post("/api/admin/contacts/delete-many", adminAuth, async (c) => {
  try {
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string")
      : [];
    if (!ids.length) {
      return c.json({ error: "Select at least one contact to delete" }, 400);
    }
    const deleted = await contactRepository.deleteMany(ids);
    logActivity(c, {
      action: "admin.contacts_deleted",
      targetType: "contact",
      detail: { count: deleted },
    });
    return c.json({ success: true, deleted });
  } catch (err) {
    console.error({ err }, "Failed to delete contacts");
    return c.json({ error: "Failed to delete contacts" }, 500);
  }
});

app.post("/api/admin/contacts/import", adminAuth, async (c) => {
  try {
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) {
      return c.json({ error: "No rows to import" }, 400);
    }
    const result = await contactRepository.importMany(rows);
    logActivity(c, {
      action: "admin.contacts_imported",
      targetType: "contact",
      detail: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped.length,
      },
    });
    return c.json(result);
  } catch (err) {
    console.error({ err }, "Failed to import contacts");
    return c.json({ error: "Failed to import contacts" }, 500);
  }
});

// Clear ALL referrals (bulk data operation). Requires an explicit typed
// confirmation in the body so a stray call can never wipe the referral table.
app.delete("/api/admin/referrals", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await c.req.json().catch(() => ({}));
    if (body?.confirm !== "DELETE ALL") {
      return c.json(
        {
          error:
            'Confirmation required: send { "confirm": "DELETE ALL" } to clear every referral.',
        },
        400,
      );
    }
    const deleted = await referralService.clearAll();
    logActivity(c, {
      action: "admin.referrals_cleared",
      targetType: "referral",
      detail: { deleted },
    });
    return c.json({ success: true, deleted });
  } catch (err) {
    console.error({ err }, "Failed to clear referrals");
    return c.json({ error: "Failed to clear referrals" }, 500);
  }
});

// Create referrals from contacts (selected ids, or all contacts when omitted)
app.post("/api/admin/referrals/from-contacts", adminAuth, async (c) => {
  try {
    await ensureReferralSchemaOnce();
    const body = await parseJson(c);
    if (body === null) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string")
      : undefined;
    const result = await referralService.createFromContacts(ids, {
      referredBy:
        typeof body?.referredBy === "string" ? body.referredBy : undefined,
      jobTitle: typeof body?.jobTitle === "string" ? body.jobTitle : undefined,
    });
    logActivity(c, {
      action: "admin.referrals_from_contacts",
      targetType: "referral",
      detail: {
        created: result.created.length,
        skipped: result.skipped.length,
        selectedOnly: Array.isArray(ids) && ids.length > 0,
      },
    });
    return c.json(result);
  } catch (err) {
    console.error({ err }, "Failed to create referrals from contacts");
    return c.json({ error: "Failed to create referrals from contacts" }, 500);
  }
});

export default app;
