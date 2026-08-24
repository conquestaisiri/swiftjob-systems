import { Resend } from "resend";
import { getEnv } from "../config";

// ============================================
// Brand & shared email layout
// ============================================
const BRAND = {
  navy: "#10251D",
  navyDeep: "#0B1A14",
  teal: "#49634B",
  tealLight: "#E8EFE4",
  mint: "#D9E6D2",
  paper: "#F7F7F4",
  paperDark: "#EEF2EB",
  text: "#253029",
  muted: "#66706A",
  border: "#DFE6DC",
  white: "#FFFFFF",
  amber: "#B45309",
  amberBg: "#FEF3C7",
  green: "#49634B",
  greenBg: "#EEF5EB",
  red: "#B91C1C",
  redBg: "#FEE2E2",
  blue: "#49634B",
  blueBg: "#E8EFE4",
  purple: "#49634B",
  purpleBg: "#E8EFE4",
};

const LOGO_PATH = "/swiftjob-mark.png";
const FALLBACK_BASE_URL = "https://swiftjob.payservice.top";
// Last-resort contact address, used only when neither SUPPORT_EMAIL nor
// HR_EMAIL is configured.
const FALLBACK_SUPPORT_EMAIL = "support@swiftjob.payservice.top";

function getBaseUrl(): string {
  const url = (getEnv().FRONTEND_URL ?? "").trim().replace(/\/$/, "");
  return url || FALLBACK_BASE_URL;
}

/** Support address shown to candidates/recipients (SUPPORT_EMAIL > HR_EMAIL). */
export function getSupportEmail(): string {
  return (
    (getEnv().SUPPORT_EMAIL ?? "").trim() ||
    getHrEmail() ||
    FALLBACK_SUPPORT_EMAIL
  );
}

function getLogoUrl(): string {
  return `${getBaseUrl()}${LOGO_PATH}`;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "\u0026#39;");
}

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const { RESEND_API_KEY } = getEnv();
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY must be set");
    }
    resendClient = new Resend(RESEND_API_KEY);
  }
  return resendClient;
}

function getFromAddress(): string {
  return (getEnv().EMAIL_FROM ?? "").trim();
}

function getHrEmail(): string {
  return (getEnv().HR_EMAIL ?? "").trim();
}

async function sendEmail(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const from = getFromAddress();
  if (!from) {
    throw new Error("EMAIL_FROM must be set");
  }
  const maxAttempts = 3;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await getResend().emails.send({
        ...opts,
        from,
        // Replies go to the support inbox instead of the send-only address.
        replyTo: getSupportEmail(),
      });
      if (error) {
        lastError = new Error(`${error.name}: ${error.message}`);
        console.warn(
          { error, to: opts.to, subject: opts.subject, attempt },
          "Email send attempt failed",
        );
      } else {
        console.log(
          { id: data?.id, to: opts.to, subject: opts.subject },
          "Email sent",
        );
        return;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        {
          to: opts.to,
          subject: opts.subject,
          attempt,
          error: lastError.message,
        },
        "Email send threw (retrying)",
      );
    }
    if (attempt < maxAttempts) {
      // Exponential backoff: 500ms, 1000ms before the last retry.
      await new Promise((resolve) =>
        setTimeout(resolve, 500 * 2 ** (attempt - 1)),
      );
    }
  }
  throw (
    lastError ??
    new Error(
      `Failed to send email to ${opts.to} after ${maxAttempts} attempts`,
    )
  );
}

interface LayoutOptions {
  preheader: string;
  headerTitle: string;
  headerSubtitle?: string;
  accent?: string;
  content: string;
}

function layout(opts: LayoutOptions): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(opts.headerTitle)}</title>
</head>
<body style="margin:0; padding:0; background:${BRAND.paper}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: ${BRAND.text};">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${esc(opts.preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.paper}; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background:${BRAND.white}; border-radius: 14px; overflow: hidden; border: 1px solid ${BRAND.border};">
          <tr>
            <td style="background:${BRAND.paperDark}; padding: 20px 32px; text-align: center; border-bottom: 3px solid ${BRAND.teal};">
              <img src="${getLogoUrl()}" alt="SwiftJob" width="112" style="max-width: 112px; height: auto; border: 0; display: inline-block;" />
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.navy}; padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; color: ${BRAND.white}; font-size: 24px; font-weight: 700; letter-spacing: -0.2px;">${esc(opts.headerTitle)}</h1>
              ${opts.headerSubtitle ? `<p style="margin: 8px 0 0; color: ${BRAND.mint}; font-size: 14px;">${esc(opts.headerSubtitle)}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              ${opts.content}
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.navy}; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 4px; color: ${BRAND.white}; font-size: 14px; font-weight: 600;">SwiftJob</p>
              <p style="margin: 0 0 12px; color: ${BRAND.mint}; font-size: 12px;">100% remote roles · work from anywhere</p>
              <a href="${getBaseUrl()}" style="color: ${BRAND.mint}; font-size: 12px; text-decoration: underline;">SwiftJob website</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function callout(
  kind: "info" | "success" | "warning" | "error",
  title: string,
  body: string,
): string {
  const styles: Record<string, { bg: string; border: string; title: string }> =
    {
      info: { bg: BRAND.tealLight, border: BRAND.teal, title: BRAND.teal },
      success: { bg: BRAND.greenBg, border: BRAND.green, title: BRAND.green },
      warning: { bg: BRAND.amberBg, border: "#D97706", title: BRAND.amber },
      error: { bg: BRAND.redBg, border: BRAND.red, title: BRAND.red },
    };
  const s = styles[kind];
  return `
    <div style="background:${s.bg}; border-left: 4px solid ${s.border}; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0 0 4px; color: ${s.title}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;">${esc(title)}</p>
      <div style="margin: 0; font-size: 14px; color: ${BRAND.text};">${body}</div>
    </div>`;
}

function primaryButton(href: string, label: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${esc(href)}" style="display: inline-block; background:${BRAND.teal}; color: ${BRAND.white}; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; letter-spacing: 0.2px;">${esc(label)}</a>
        </td>
      </tr>
    </table>`;
}

function sectionTitle(text: string): string {
  return `<h2 style="margin: 28px 0 12px; color: ${BRAND.navy}; font-size: 16px; font-weight: 700;">${esc(text)}</h2>`;
}

function stepList(steps: string[]): string {
  const items = steps
    .map(
      (s, i) => `
      <li style="margin-bottom: 10px; font-size: 14px; color: ${BRAND.text};">
        <span style="display: inline-block; width: 22px; height: 22px; line-height: 22px; text-align: center; border-radius: 50%; background:${BRAND.teal}; color: ${BRAND.white}; font-size: 12px; font-weight: 700; margin-right: 10px;">${i + 1}</span>${s}
      </li>`,
    )
    .join("");
  return `<ol style="margin: 0; padding: 0; list-style: none;">${items}</ol>`;
}

function footerNote(): string {
  return `
    <hr style="border: none; border-top: 1px solid ${BRAND.border}; margin: 28px 0;">
    <p style="color: ${BRAND.muted}; font-size: 12px; margin: 0; text-align: center;">
      This is an automated message from SwiftJob. You're receiving it because you either applied for a role or requested a sign-in link.<br>
      Questions? Reply to this email or write to <a href="mailto:${getSupportEmail()}" style="color: ${BRAND.teal};">${getSupportEmail()}</a>.
    </p>`;
}

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 10px 16px; border-top: 1px solid ${BRAND.border}; width: 40%; font-weight: 600; color: ${BRAND.navy}; font-size: 13px; background: ${BRAND.paper}; vertical-align: top;">${esc(label)}</td>
      <td style="padding: 10px 16px; border-top: 1px solid ${BRAND.border}; font-size: 13px; color: ${BRAND.text}; vertical-align: top;">${value}</td>
    </tr>`;
}

function infoTable(rows: Array<[string, string]>): string {
  const body = rows.map(([label, value]) => infoRow(label, value)).join("");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin: 16px 0; border: 1px solid ${BRAND.border}; border-radius: 8px; overflow: hidden;">
      ${body}
    </table>`;
}

// ============================================
// Application notification (HR)
// ============================================
// ============================================
// Referral click notification (HR/admin)
// ============================================
function formatReferralClickHtml(data: {
  fullName: string;
  referredBy?: string | null;
  position: string;
  referralCode: string;
  deviceType: string;
  clickedAt: Date;
}): string {
  const deviceLabel =
    data.deviceType === "mobile" ? "Mobile phone" : "PC / laptop";
  const deviceColor = data.deviceType === "mobile" ? "#B45309" : BRAND.green;
  const content = `
    <p style="margin: 0 0 12px; font-size: 15px;">A referred lead just clicked <em>continue</em> on their private invitation page.</p>

    ${infoTable([
      ["Name", esc(data.fullName)],
      ["Referred by", esc(data.referredBy ?? "—")],
      ["Position", esc(data.position)],
      [
        "Referral code",
        `<code style="background: ${BRAND.paper}; padding: 2px 6px; border-radius: 4px;">${esc(data.referralCode)}</code>`,
      ],
      [
        "Device",
        `<span style="font-weight:700; color:${deviceColor};">${deviceLabel}</span>`,
      ],
      [
        "Clicked",
        `<span>${esc(data.clickedAt.toISOString().replace("T", " ").slice(0, 16))} UTC</span>`,
      ],
    ])}

    ${
      data.deviceType === "mobile"
        ? callout(
            "warning",
            "Mobile device",
            `This click came from a ${deviceLabel}. The next step was <strong>blocked</strong> for them and they were asked to continue on a desktop/laptop. If this lead used a phone, they will open the page again from their PC — you may see a second click shortly.`,
          )
        : callout(
            "success",
            "Laptop confirmed",
            `This lead is on a <strong>${deviceLabel}</strong> and was allowed through to the next step.`,
          )
    }

    <p style="font-size: 13px; color: ${BRAND.muted}; margin: 8px 0 0;">Manage this referral in the <a href="${getBaseUrl()}/admin" style="color: ${BRAND.teal};">admin dashboard</a>.</p>
  `;
  return layout({
    preheader: `Referral click: ${data.fullName} (${deviceLabel})`,
    headerTitle: "Referral Link Clicked",
    headerSubtitle: `${data.fullName} — ${data.position}`,
    content,
  });
}

interface ApplicationEmailData {
  applicationId: string;
  position: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  yearsExperience: string;
  education: string;
  englishProficiency: string;
  noticePeriod: string;
  expectedSalary: string;
  earliestStartDate: string;
  skills: string;
}

function formatApplicationHtml(data: ApplicationEmailData): string {
  const rows: Array<[string, string]> = [
    ["Full name", esc(data.fullName)],
    [
      "Email",
      `<a href="mailto:${esc(data.email)}" style="color: ${BRAND.teal};">${esc(data.email)}</a>`,
    ],
    ["Phone", esc(data.phone)],
    ["Location", `${esc(data.city)}, ${esc(data.country)}`],
    ["Years of experience", esc(data.yearsExperience)],
    ["Education", esc(data.education)],
    ["English proficiency", esc(data.englishProficiency)],
    ["Notice period", esc(data.noticePeriod)],
    ["Expected salary", esc(data.expectedSalary)],
    ["Earliest start date", esc(data.earliestStartDate)],
  ];
  if (data.linkedinUrl)
    rows.push([
      "LinkedIn",
      `<a href="${esc(data.linkedinUrl)}" style="color: ${BRAND.teal};">${esc(data.linkedinUrl)}</a>`,
    ]);
  if (data.portfolioUrl)
    rows.push([
      "Portfolio",
      `<a href="${esc(data.portfolioUrl)}" style="color: ${BRAND.teal};">${esc(data.portfolioUrl)}</a>`,
    ]);

  const content = `
    <p style="margin: 0 0 8px; font-size: 15px;">A new application has been submitted through the SwiftJob careers portal.</p>

    ${callout("info", "Position", `<strong style="font-size: 15px;">${esc(data.position)}</strong>`)}
    ${infoTable(rows)}

    ${sectionTitle("Skills")}
    <p style="background: ${BRAND.paper}; padding: 14px 16px; border-radius: 8px; border: 1px solid ${BRAND.border}; white-space: pre-wrap; margin: 0; font-size: 13px;">${esc(data.skills)}</p>

    ${sectionTitle("Your next steps")}
    <p style="font-size: 14px; margin: 0 0 8px;">Please review this application and update its status in the admin dashboard.</p>
    <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: ${BRAND.text};">
      <li style="margin-bottom: 8px;">Review the candidate's profile and resume.</li>
      <li style="margin-bottom: 8px;">Set an initial status (<strong>Reviewing</strong>, <strong>Shortlisted</strong>, or <strong>Rejected</strong>).</li>
      <li style="margin-bottom: 8px;">The candidate is notified automatically whenever you change the status.</li>
    </ol>
    <p style="font-size: 13px; color: ${BRAND.muted}; margin: 8px 0 0;">Open the <a href="${getBaseUrl()}/admin" style="color: ${BRAND.teal};">admin dashboard</a> to review this application.</p>
  `;

  return layout({
    preheader: `New application received for ${data.position}`,
    headerTitle: "New Application Received",
    headerSubtitle: `${data.fullName} — ${data.position}`,
    content,
  });
}

// ============================================
// Applicant confirmation
// ============================================
function formatConfirmationHtml(data: {
  position: string;
  fullName: string;
  applicationId: string;
  referenceCode?: string;
}): string {
  const referenceBlock = data.referenceCode
    ? `
      ${sectionTitle("Your reference code")}
      <div style="background: ${BRAND.paper}; border: 2px dashed ${BRAND.teal}; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
        <code style="font-size: 20px; font-weight: 700; color: ${BRAND.teal}; letter-spacing: 2px;">${esc(data.referenceCode)}</code>
      </div>
      <p style="font-size: 13px; color: ${BRAND.muted}; margin: 0;">Keep this code handy — quote it whenever you contact us and we'll find your application straight away.</p>`
    : "";

  const content = `
    <p style="margin: 0 0 12px; font-size: 15px;">Hi <strong>${esc(data.fullName)}</strong>,</p>
    <p style="margin: 0 0 12px; font-size: 15px;">Thank you for applying to the <strong>${esc(data.position)}</strong> position at SwiftJob. We've received your application successfully.</p>

    ${sectionTitle("Your application")}
    ${infoTable([
      [
        "Application ID",
        `<code style="background: ${BRAND.paper}; padding: 2px 8px; border-radius: 4px;">${esc(data.applicationId)}</code>`,
      ],
      ["Position", esc(data.position)],
      ["Submitted", "Received and queued for review"],
    ])}
    ${referenceBlock}

    ${callout(
      "info",
      "What happens next",
      `
      Our recruitment team reviews applications within <strong>3–5 business days</strong>. If your profile matches the role, we'll contact you to arrange the next steps.
    `,
    )}

    ${sectionTitle("The hiring process")}
    ${stepList([
      `<strong>Application review</strong> — We evaluate your experience, skills, and fit for the role.`,
      `<strong>Skills check</strong> — A short optional check matched to the position, completed in your browser.`,
      `<strong>Team review &amp; feedback</strong> — Our recruitment team reaches out directly with the outcome and next steps.`,
      `<strong>Offer &amp; onboarding</strong> — Successful candidates receive a formal offer and a fully remote start.`,
    ])}

    ${callout(
      "success",
      "What you need to do now",
      `
      Nothing right now. We'll email you as soon as your status changes. To keep things moving, make sure your contact details stay up to date and keep an eye on your inbox (including spam/junk).
    `,
    )}
  `;

  return layout({
    preheader: `We've received your application for ${data.position}`,
    headerTitle: "Application Received",
    headerSubtitle: "Thank you for applying to SwiftJob",
    content,
  });
}

// ============================================
// Status update
// ============================================
interface StatusDetail {
  message: string;
  meaning: string;
  nextSteps: string;
  color: string;
}

const STATUS_DETAILS: Record<string, StatusDetail> = {
  Reviewing: {
    color: "#1D4ED8",
    message:
      "Your application is currently being reviewed by our recruitment team.",
    meaning:
      "We've confirmed your application looks promising and are taking a closer look at your experience and skills against the role.",
    nextSteps:
      "You don't need to do anything right now. We typically complete the review within 3–5 business days. We'll email you the moment your status changes.",
  },
  Shortlisted: {
    color: "#6D28D9",
    message: "Congratulations — you've been shortlisted!",
    meaning:
      "You're moving forward in the process. Your profile stood out and we'd like to get to know you better.",
    nextSteps:
      "Our recruitment team will be in touch shortly by email with the next steps — nothing to schedule or prepare. You can also track your application status anytime in your candidate portal.",
  },
  Rejected: {
    color: "#B91C1C",
    message: "Thank you for your interest in this role.",
    meaning:
      "After careful consideration, we've decided to move forward with other candidates whose profiles more closely match the role.",
    nextSteps:
      "We genuinely appreciate the time you invested. Please keep an eye on our careers page — we post new roles regularly and would welcome your application again in the future.",
  },
  Hired: {
    color: "#0F766E",
    message: "Congratulations — we're delighted to offer you the position!",
    meaning:
      "You're now part of the SwiftJob team. We're excited to have you onboard.",
    nextSteps:
      "Our team will reach out shortly with your offer details, start date, and onboarding steps. Watch your inbox and be ready to provide any requested documents.",
  },
};

function formatStatusUpdateHtml(data: {
  fullName: string;
  position: string;
  applicationId: string;
  status: string;
  message: string;
  referenceCode?: string;
  notes?: string;
  isShortlistUpdate?: boolean;
}): string {
  const detail = STATUS_DETAILS[data.status];
  const statusColor = detail?.color ?? BRAND.teal;
  const notesBlock = data.notes
    ? callout("warning", "Notes from our team", esc(data.notes))
    : "";

  const referenceBlock = data.referenceCode
    ? `<p style="font-size: 13px; color: ${BRAND.muted}; margin-top: 12px;"><strong>Reference code:</strong> <code style="background: ${BRAND.paper}; padding: 3px 8px; border-radius: 4px; font-size: 14px;">${esc(data.referenceCode)}</code></p>`
    : "";

  const statusBox = `
    <div style="background: ${BRAND.paper}; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; border: 1px solid ${BRAND.border};">
      <p style="margin: 0 0 6px; color: ${BRAND.muted}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Application status</p>
      <p style="margin: 0; font-size: 26px; font-weight: 700; color: ${statusColor};">${esc(data.status)}</p>
    </div>`;

  const nextSteps = detail
    ? callout("info", "What happens next", detail.nextSteps)
    : callout("info", "What happens next", esc(data.message));

  const shortlistBlock = data.isShortlistUpdate
    ? callout(
        "success",
        "You've been shortlisted",
        `
        Congratulations — you've been shortlisted for <strong>${esc(data.position)}</strong>. Our recruitment team will contact you directly by email with the next steps. You can also track your application status anytime in your secure candidate portal.
      `,
      )
    : "";

  const securityBlock = data.isShortlistUpdate
    ? callout(
        "warning",
        "Stay safe — official communication only",
        `
        SwiftJob will <strong>only</strong> ever contact you from official SwiftJob email addresses and through your secure candidate portal. We will never ask you for money, payment, or sensitive personal information. If you receive anything suspicious, do not click links — just ignore it.
      `,
      )
    : "";

  const content = `
    <p style="margin: 0 0 12px; font-size: 15px;">Hi <strong>${esc(data.fullName)}</strong>,</p>
    <p style="margin: 0 0 4px; font-size: 15px;">There's an update on your application for <strong>${esc(data.position)}</strong>.</p>
    <p style="margin: 0 0 12px; font-size: 13px; color: ${BRAND.muted};">Application ID: <code style="background: ${BRAND.paper}; padding: 2px 8px; border-radius: 4px;">${esc(data.applicationId)}</code></p>

    ${statusBox}

    <p style="font-size: 15px; margin: 0 0 8px;"><strong>${esc(detail?.message ?? data.message)}</strong></p>
    ${detail ? `<p style="font-size: 14px; margin: 0;">${esc(detail.meaning)}</p>` : ""}

    ${shortlistBlock}

    ${notesBlock}

    ${nextSteps}

    ${securityBlock}

    ${sectionTitle("View your application")}
    <p style="font-size: 14px; margin: 0 0 12px;">Sign in to your candidate portal to see your full application, status history, and any instructions we've shared with you.</p>
    ${primaryButton(`${getBaseUrl()}/login`, "Open my candidate portal")}
    ${referenceBlock}
  `;

  return layout({
    preheader: `Your application for ${data.position} is now: ${data.status}`,
    headerTitle: "Application Status Update",
    headerSubtitle: `${data.position} — ${data.status}`,
    content,
  });
}

// ============================================
// Contact notification (HR)
// ============================================
function formatContactHtml(data: {
  firstName: string;
  email: string;
  interest: string;
  message: string;
}): string {
  const content = `
    <p style="margin: 0 0 12px; font-size: 15px;">A new message was submitted through the contact form on the SwiftJob website.</p>

    ${infoTable([
      ["Name", esc(data.firstName)],
      [
        "Email",
        `<a href="mailto:${esc(data.email)}" style="color: ${BRAND.teal};">${esc(data.email)}</a>`,
      ],
      ["Interest", esc(data.interest)],
    ])}

    ${sectionTitle("Message")}
    <p style="background: ${BRAND.paper}; padding: 14px 16px; border-radius: 8px; border: 1px solid ${BRAND.border}; white-space: pre-wrap; margin: 0; font-size: 13px;">${esc(data.message)}</p>

    ${callout(
      "info",
      "Your next step",
      `
      Reply to this lead within 1 business day. The inquirer asked about <strong>${esc(data.interest)}</strong>.
    `,
    )}
  `;

  return layout({
    preheader: `New contact message from ${data.firstName}`,
    headerTitle: "New Contact Message",
    headerSubtitle: "Submitted via the SwiftJob website",
    content,
  });
}

// ============================================
// Magic link
// ============================================
function formatMagicLinkHtml(data: {
  linkUrl: string;
  fullName?: string;
}): string {
  const greeting = data.fullName
    ? `Hi <strong>${esc(data.fullName)}</strong>,`
    : "Hi there,";
  const content = `
    <p style="margin: 0 0 12px; font-size: 15px;">${greeting}</p>
    <p style="margin: 0 0 12px; font-size: 15px;">You requested a secure sign-in link for your SwiftJob candidate portal. Click the button below to sign in and view your applications.</p>

    ${primaryButton(data.linkUrl, "Sign in to my portal")}

    ${callout(
      "warning",
      "This link expires in 15 minutes",
      `
      For your security, this link is single-use and valid for <strong>15 minutes</strong>. If it expires, simply request a new one on the sign-in page.
    `,
    )}

    ${sectionTitle("How signing in works")}
    ${stepList([
      `Click the button above (or the link below).`,
      `You'll be signed in automatically — no password needed.`,
      `You'll land on your applications page where you can view your status.`,
    ])}

    <p style="font-size: 13px; color: ${BRAND.muted}; word-break: break-all; margin: 16px 0 0;">If the button doesn't work, copy this link into your browser:<br><a href="${esc(data.linkUrl)}" style="color: ${BRAND.teal};">${esc(data.linkUrl)}</a></p>

    <hr style="border: none; border-top: 1px solid ${BRAND.border}; margin: 24px 0;">

    <p style="font-size: 13px; color: ${BRAND.muted}; margin: 0;">If you didn't request this link, you can safely ignore this email — no action is needed.</p>
  `;

  return layout({
    preheader: "Your secure sign-in link for the SwiftJob candidate portal",
    headerTitle: "Your Sign-In Link",
    headerSubtitle: "SwiftJob candidate portal",
    content,
  });
}

// ============================================
// Referral invitation
// ============================================
function formatReferralInvitationHtml(data: {
  fullName: string;
  referredBy?: string | null;
  position: string;
  referralUrl: string;
  content: {
    emailGreeting?: string;
    emailBody?: string;
    emailCtaLabel?: string;
    emailClosing?: string;
  };
}): string {
  const body =
    data.content.emailBody ??
    "You've been referred and we'd love for you to review this opportunity.";
  const content = `
    <p style="margin: 0 0 12px; font-size: 15px;">${esc(data.content.emailGreeting ?? `Hi ${data.fullName},`)}</p>
    <p style="margin: 0 0 4px; font-size: 15px; white-space: pre-wrap;">${esc(body)}</p>

    ${primaryButton(data.referralUrl, data.content.emailCtaLabel ?? "Open my briefing")}

    <p style="font-size: 14px; margin: 0 0 12px; white-space: pre-wrap;">${esc(data.content.emailClosing ?? "When you're ready, just follow the steps inside.")}</p>

    <hr style="border: none; border-top: 1px solid ${BRAND.border}; margin: 24px 0;">
    <p style="font-size: 13px; color: ${BRAND.muted}; margin: 0;">
      This briefing is private to you. If you have any questions or run into any technical problem, contact <a href="mailto:${getSupportEmail()}" style="color: ${BRAND.teal};">${getSupportEmail()}</a> and they will respond ASAP to rectify it.
    </p>
  `;

  return layout({
    preheader: `Your referral briefing from SwiftJob`,
    headerTitle: "You've been referred",
    headerSubtitle: data.position,
    content,
  });
}

function interpolateText(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(
    /\{(name|position|referredBy|code|hrEmail)\}/g,
    (_, key: string) => vars[key] ?? "",
  );
}

// ============================================
// Email service
// ============================================
export const emailService = {
  async sendContactNotification(data: {
    firstName: string;
    email: string;
    interest: string;
    message: string;
  }): Promise<void> {
    await sendEmail({
      from: getFromAddress(),
      to: getHrEmail(),
      subject: `New contact message: ${data.firstName} (${data.interest})`,
      html: formatContactHtml(data),
    });
  },

  async sendMagicLink(data: {
    email: string;
    linkUrl: string;
    fullName?: string;
  }): Promise<void> {
    await sendEmail({
      from: getFromAddress(),
      to: data.email,
      subject: `Sign in to your SwiftJob candidate portal`,
      html: formatMagicLinkHtml({
        linkUrl: data.linkUrl,
        fullName: data.fullName,
      }),
    });
  },

  async sendStatusUpdate(data: {
    email: string;
    fullName: string;
    position: string;
    status: string;
    applicationId: string;
    referenceCode?: string;
    notes?: string;
    isShortlistUpdate?: boolean;
  }): Promise<void> {
    const detail = STATUS_DETAILS[data.status];
    const message =
      detail?.message ??
      `Your application status has been updated to: ${data.status}`;

    await sendEmail({
      from: getFromAddress(),
      to: data.email,
      subject: `Application Update: ${data.position} — ${data.status}`,
      html: formatStatusUpdateHtml({ ...data, message }),
    });
  },

  async sendApplicationNotification(data: ApplicationEmailData): Promise<void> {
    await sendEmail({
      from: getFromAddress(),
      to: getHrEmail(),
      subject: `New Application: ${data.position} — ${data.fullName} (${data.applicationId})`,
      html: formatApplicationHtml(data),
    });
  },

  async sendApplicantConfirmation(data: {
    position: string;
    fullName: string;
    email: string;
    applicationId: string;
    referenceCode?: string;
  }): Promise<void> {
    await sendEmail({
      from: getFromAddress(),
      to: data.email,
      subject: `Application Received: ${data.position} at SwiftJob`,
      html: formatConfirmationHtml(data),
    });
  },

  async sendReferralInvitation(data: {
    email: string;
    fullName: string;
    referredBy?: string | null;
    jobTitle?: string | null;
    referralCode: string;
    subject: string;
    greeting: string;
    body: string;
    ctaLabel: string;
    closing: string;
  }): Promise<void> {
    const position = data.jobTitle ?? "this role";
    await sendEmail({
      from: getFromAddress(),
      to: data.email,
      subject: data.subject,
      html: formatReferralInvitationHtml({
        fullName: data.fullName,
        referredBy: data.referredBy,
        position,
        referralUrl: `${getBaseUrl()}/referral/${data.referralCode}`,
        content: {
          emailGreeting: data.greeting,
          emailBody: data.body,
          emailCtaLabel: data.ctaLabel,
          emailClosing: data.closing,
        },
      }),
    });
  },

  async sendCustomEmail(data: {
    email: string;
    subject: string;
    html: string;
  }): Promise<void> {
    await sendEmail({
      from: getFromAddress(),
      to: data.email,
      subject: data.subject,
      html: data.html,
    });
  },

  async sendReferralClickNotification(data: {
    fullName: string;
    referredBy?: string | null;
    position: string;
    referralCode: string;
    deviceType: string;
    clickedAt: Date;
  }): Promise<void> {
    await sendEmail({
      from: getFromAddress(),
      to: getHrEmail(),
      subject: `Referral clicked: ${data.fullName} (${data.deviceType === "mobile" ? "mobile" : "PC / laptop"})`,
      html: formatReferralClickHtml({
        fullName: data.fullName,
        referredBy: data.referredBy,
        position: data.position,
        referralCode: data.referralCode,
        deviceType: data.deviceType,
        clickedAt: data.clickedAt,
      }),
    });
  },
};
