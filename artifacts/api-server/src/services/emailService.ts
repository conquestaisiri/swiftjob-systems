import { Resend } from "resend";
import { logger } from "../lib/logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = (process.env.EMAIL_FROM ?? "").trim();
const HR_EMAIL = (process.env.HR_EMAIL ?? "").trim();

if (!RESEND_API_KEY || !EMAIL_FROM || !HR_EMAIL) {
  throw new Error("RESEND_API_KEY, EMAIL_FROM, and HR_EMAIL must be set");
}

const resend = new Resend(RESEND_API_KEY);

// Escape all user-provided values so an applicant cannot inject HTML
// into emails sent to HR or to other applicants.
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Resend's SDK resolves with { data, error } rather than throwing on API
// errors, so we must inspect the response explicitly to avoid silent failures.
async function sendEmail(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const { data, error } = await resend.emails.send(opts);
  if (error) {
    logger.error(
      { error, to: opts.to, subject: opts.subject, name: error.name },
      "Failed to send email",
    );
    throw new Error(`${error.name}: ${error.message}`);
  }
  logger.info(
    { id: data?.id, to: opts.to, subject: opts.subject },
    "Email sent",
  );
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
  const emailHref = esc(`mailto:${data.email}`);
  const linkedinRow = data.linkedinUrl
    ? `<tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">LinkedIn</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;"><a href="${esc(data.linkedinUrl)}" style="color: #0ea5e9;">${esc(data.linkedinUrl)}</a></td>
      </tr>`
    : "";
  const portfolioRow = data.portfolioUrl
    ? `<tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Portfolio</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;"><a href="${esc(data.portfolioUrl)}" style="color: #0ea5e9;">${esc(data.portfolioUrl)}</a></td>
      </tr>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Application Received</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); padding: 32px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">New Application Received</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Application ID: ${esc(data.applicationId)}</p>
  </div>

  <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
    <h2 style="color: #1e293b; margin-top: 0; font-size: 18px;">Position: ${esc(data.position)}</h2>

    <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; width: 40%; font-weight: 600; color: #475569;">Full Name</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">${esc(data.fullName)}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Email</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;"><a href="${emailHref}" style="color: #0ea5e9;">${esc(data.email)}</a></td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Phone</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">${esc(data.phone)}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Location</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">${esc(data.city)}, ${esc(data.country)}</td>
      </tr>
      ${linkedinRow}
      ${portfolioRow}
    </table>

    <h3 style="color: #1e293b; margin: 24px 0 12px; font-size: 16px;">Experience & Qualifications</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; width: 40%; font-weight: 600; color: #475569;">Years of Experience</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${esc(data.yearsExperience)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Education</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${esc(data.education)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">English Proficiency</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${esc(data.englishProficiency)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Notice Period</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${esc(data.noticePeriod)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Expected Salary</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${esc(data.expectedSalary)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Earliest Start Date</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${esc(data.earliestStartDate)}</td>
      </tr>
    </table>

    <h3 style="color: #1e293b; margin: 24px 0 12px; font-size: 16px;">Skills</h3>
    <p style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap;">${esc(data.skills)}</p>

    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 14px; margin: 0;">This application was submitted via the SwiftJob careers portal.</p>
      <p style="color: #64748b; font-size: 14px; margin: 8px 0 0;">Log in to the admin dashboard to review and update the application status.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function formatConfirmationHtml(data: {
  position: string;
  fullName: string;
  applicationId: string;
  referenceCode?: string;
}): string {
  const referenceBlock = data.referenceCode
    ? `<p style="font-size: 16px;">Keep this reference code to access your application status at any time:</p>

    <div style="background: white; border: 2px solid #0ea5e9; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
      <code style="font-size: 18px; font-weight: 600; color: #0ea5e9; letter-spacing: 1px;">${esc(data.referenceCode)}</code>
    </div>

    <p style="font-size: 16px;">We'll also email you a sign-in link whenever your application status is updated. You can use either your reference code or that link to return to your application.</p>`
    : `<p style="font-size: 16px;">We'll send you email updates about your application. When your status changes, we'll include a sign-in link so you can view your application online.</p>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Received - SwiftJob</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Application Received</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0; font-size: 16px;">Thank you for applying to SwiftJob</p>
  </div>

  <div style="background: #f8fafc; padding: 40px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
    <p style="font-size: 16px; margin-top: 0;">Hi <strong>${esc(data.fullName)}</strong>,</p>

    <p style="font-size: 16px;">We've successfully received your application for the <strong>${esc(data.position)}</strong> position. Your application ID is:</p>

    <div style="background: white; border: 2px solid #0ea5e9; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
      <code style="font-size: 18px; font-weight: 600; color: #0ea5e9; letter-spacing: 1px;">${esc(data.applicationId)}</code>
    </div>

    <p style="font-size: 16px;">Our recruitment team will review your application and get back to you within <strong>5-7 business days</strong>. If your profile matches our requirements, we'll contact you to schedule the next steps.</p>

    ${referenceBlock}

    <h3 style="color: #1e293b; margin: 32px 0 16px; font-size: 18px;">What happens next?</h3>
    <ol style="padding-left: 20px; color: #334155;">
      <li style="margin-bottom: 12px;"><strong>Application Review</strong> — Our team evaluates your experience, skills, and fit for the role.</li>
      <li style="margin-bottom: 12px;"><strong>Shortlisting</strong> — Qualified candidates move to a brief video screening.</li>
      <li style="margin-bottom: 12px;"><strong>Skills Assessment</strong> — A practical task relevant to the position.</li>
      <li style="margin-bottom: 12px;"><strong>Interview</strong> — A conversation with our recruitment team and/or the hiring manager.</li>
      <li style="margin-bottom: 12px;"><strong>Offer &amp; Onboarding</strong> — Reference checks followed by a structured start.</li>
    </ol>

    <div style="margin-top: 32px; padding: 20px; background: #eff6ff; border-radius: 8px; border-left: 4px solid #0ea5e9;">
      <p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>Need to update your application?</strong> Reply to this email or contact us at <a href="mailto:careers@swiftjob.payservice.top" style="color: #0ea5e9;">careers@swiftjob.payservice.top</a> with your application ID.</p>
    </div>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">

    <p style="color: #64748b; font-size: 14px; margin: 0; text-align: center;">
      SwiftJob — Global Workforce Partner<br>
      <a href="https://swiftjob.payservice.top" style="color: #0ea5e9;">swiftjob.payservice.top</a>
    </p>
  </div>
</body>
</html>
  `.trim();
}

function formatStatusUpdateHtml(data: {
  fullName: string;
  position: string;
  applicationId: string;
  status: string;
  message: string;
  referenceCode?: string;
  notes?: string;
}): string {
  const notesBlock = data.notes
    ? `<p style="background: #fef3c7; border-radius: 8px; padding: 16px; border-left: 4px solid #f59e0b;"><strong>Notes:</strong> ${esc(data.notes)}</p>`
    : "";
  const referenceBlock = data.referenceCode
    ? `<p style="font-size: 14px; color: #64748b; margin-top: 16px;"><strong>Reference code:</strong> <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${esc(data.referenceCode)}</code></p>`
    : "";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Application Status Update</h1>
  </div>
  <div style="background: #f8fafc; padding: 40px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
    <p>Hi <strong>${esc(data.fullName)}</strong>,</p>
    <p>Your application for <strong>${esc(data.position)}</strong> (ID: ${esc(data.applicationId)}) has been updated.</p>
    <div style="background: white; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center; border: 1px solid #e2e8f0;">
      <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">NEW STATUS</p>
      <p style="margin: 0; font-size: 24px; font-weight: 700; color: #0ea5e9;">${esc(data.status)}</p>
    </div>
    <p>${esc(data.message)}</p>
    ${notesBlock}
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://swiftjob.payservice.top/login" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">View your application status</a>
    </div>
    <p style="font-size: 14px; color: #64748b; text-align: center;">Enter your email on the login page and we'll send you a one-time sign-in link, or use your reference code.</p>
    ${referenceBlock}
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
    <p style="color: #64748b; font-size: 14px; margin: 0; text-align: center;">SwiftJob</p>
  </div>
</body>
</html>
  `.trim();
}

function formatContactHtml(data: {
  firstName: string;
  email: string;
  interest: string;
  message: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Message</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); padding: 32px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">New Contact Message</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Submitted via the SwiftJob website contact form</p>
  </div>

  <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
    <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; width: 40%; font-weight: 600; color: #475569;">Name</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">${esc(data.firstName)}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Email</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${esc(data.email)}" style="color: #0ea5e9;">${esc(data.email)}</a></td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Interest</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">${esc(data.interest)}</td>
      </tr>
    </table>

    <h3 style="color: #1e293b; margin: 24px 0 12px; font-size: 16px;">Message</h3>
    <p style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap;">${esc(data.message)}</p>

    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 14px; margin: 0;">This message was sent from the contact form on       <a href="https://swiftjob.payservice.top" style="color: #0ea5e9;">swiftjob.payservice.top</a>.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function formatMagicLinkHtml(data: { linkUrl: string }): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SwiftJob candidate portal link</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); padding: 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Sign in to your candidate portal</h1>
  </div>
  <div style="background: #f8fafc; padding: 40px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
    <p style="font-size: 16px;">Hi there,</p>
    <p style="font-size: 16px;">Click the button below to view your SwiftJob application status. This link expires in 15 minutes.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${esc(data.linkUrl)}" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">View my application</a>
    </div>
    <p style="font-size: 14px; color: #64748b; word-break: break-all;">Link: ${esc(data.linkUrl)}</p>
    <p style="font-size: 14px; color: #64748b;">If you didn't request this link, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
    <p style="color: #64748b; font-size: 14px; margin: 0; text-align: center;">SwiftJob</p>
  </div>
</body>
</html>
  `.trim();
}

export const emailService = {
  async sendContactNotification(data: {
    firstName: string;
    email: string;
    interest: string;
    message: string;
  }): Promise<void> {
    await sendEmail({
      from: EMAIL_FROM,
      to: HR_EMAIL,
      subject: `New contact message: ${data.firstName} (${data.interest})`,
      html: formatContactHtml(data),
    });
  },

  async sendMagicLink(data: { email: string; linkUrl: string }): Promise<void> {
    await sendEmail({
      from: EMAIL_FROM,
      to: data.email,
      subject: `Your SwiftJob candidate portal link`,
      html: formatMagicLinkHtml({ linkUrl: data.linkUrl }),
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
  }): Promise<void> {
    const statusMessages: Record<string, string> = {
      Reviewing:
        "Your application is currently under review by our recruitment team.",
      Shortlisted:
        "Congratulations! You've been shortlisted. Our team will contact you soon to schedule the next steps.",
      Rejected:
        "Thank you for your interest. After careful consideration, we've decided to move forward with other candidates.",
      Hired:
        "Congratulations! We're excited to offer you the position. Our team will reach out with details.",
    };

    const message =
      statusMessages[data.status] ||
      `Your application status has been updated to: ${data.status}`;

    await sendEmail({
      from: EMAIL_FROM,
      to: data.email,
      subject: `Application Update: ${data.position} - ${data.status}`,
      html: formatStatusUpdateHtml({ ...data, message }),
    });
  },

  async sendApplicationNotification(data: ApplicationEmailData): Promise<void> {
    await sendEmail({
      from: EMAIL_FROM,
      to: HR_EMAIL,
      subject: `New Application: ${data.position} - ${data.fullName} (${data.applicationId})`,
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
      from: EMAIL_FROM,
      to: data.email,
      subject: `Application Received: ${data.position} at SwiftJob`,
      html: formatConfirmationHtml(data),
    });
  },
};
