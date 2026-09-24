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

// Shared dark-mode surface approved for email section banners and table labels.
// It is intentionally near-white so the dark layout remains readable without
// losing the SwiftJob green identity.
const DARK_MODE_MINT = "#EEF9F0";
const DARK_MODE_MINT_BORDER = "#D5E9D8";
const DARK_MODE_MINT_TEXT = "#10251D";

const EMAIL_LOGO_PATH = "/swiftjob-email-lockup.png";
// Version the email asset URL to avoid stale copies in mail-client caches.
const EMAIL_LOGO_VERSION = "white-lockup-20260924";
const FALLBACK_BASE_URL = "https://swiftjob.online";
// Last-resort contact address, used only when neither SUPPORT_EMAIL nor
// HR_EMAIL is configured.
const FALLBACK_SUPPORT_EMAIL = "support@swiftjob.online";

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

function getEmailLogoUrl(): string {
  return `${getBaseUrl()}${EMAIL_LOGO_PATH}?v=${EMAIL_LOGO_VERSION}`;
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

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, label: string) =>
        `${label.replace(/<[^>]+>/g, "")} (${href.replace(/&amp;/gi, "&")})`,
    )
    .replace(/<br\s*\/?>(\r?\n)?/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
        text: htmlToText(opts.html),
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
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    .email-body { background: #F7F7F4 !important; color: #253029 !important; }
    .email-card, .email-surface { background: #FFFFFF !important; border-color: #DFE6DC !important; }
    .email-message { background: #F7F7F4 !important; border-color: #DFE6DC !important; }
    .email-content { background: #FFFFFF !important; color: #253029 !important; }
    .email-section-title { color: #10251D !important; }
    .email-copy { color: #253029 !important; }
    .email-muted { color: #66706A !important; }
    .email-table { border-color: #DFE6DC !important; }
    .email-table-label { background-color: #F7F7F4 !important; color: #10251D !important; }
    .email-table-value { background: #FFFFFF !important; color: #253029 !important; }
    .email-link { color: #49634B !important; }
    .email-content a:not(.email-button) { color: #49634B !important; }
    .email-callout-body { color: #253029 !important; }
    .email-callout-info, .email-callout-success { background: #E8EFE4 !important; }
    .email-callout-warning { background: #FEF3C7 !important; }
    .email-callout-error { background: #FEE2E2 !important; }
    .email-step { color: #253029 !important; }
    .email-status-box { background: #F7F7F4 !important; border-color: #DFE6DC !important; }
    .email-status-label { color: #66706A !important; }
    .email-status-value { color: #253029 !important; }
    .email-code { background: #F7F7F4 !important; color: #253029 !important; }
    .email-logo-bar { background: #FFFFFF !important; }
    .email-logo-image { display: inline-block !important; }
    .email-button { background: #49634B !important; color: #FFFFFF !important; }
    /* Gmail iOS fully inverts colors and does not apply prefers-color-scheme.
       These Gmail-only blend layers preserve the approved label swatch/text. */
    u + .body .gmail-blend-screen { background: #000000; mix-blend-mode: screen; }
    u + .body .gmail-blend-difference { background: #000000; mix-blend-mode: difference; }
    u + .body .email-table-label {
      background-color: ${DARK_MODE_MINT} !important;
      background-image: linear-gradient(${DARK_MODE_MINT}, ${DARK_MODE_MINT}) !important;
    }
    @media only screen and (max-width: 620px) {
      .email-shell { padding: 12px 6px !important; }
      .email-logo-bar, .email-header, .email-content, .email-footer { padding-left: 20px !important; padding-right: 20px !important; }
      .email-content { padding-top: 24px !important; padding-bottom: 24px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-body { background: #0F1713 !important; color: #EFF7F0 !important; }
      .email-card, .email-content, .email-surface, .email-table-value { background: #17221C !important; border-color: #2E4336 !important; }
      .email-section-title { color: #DCEBD9 !important; }
      .email-copy, .email-callout-body, .email-step { color: #EFF7F0 !important; }
      .email-muted { color: #BAC8BE !important; }
      .email-table { border-color: #2E4336 !important; }
      .email-header { background: ${DARK_MODE_MINT} !important; border-bottom: 1px solid ${DARK_MODE_MINT_BORDER} !important; }
      .email-header h1 { color: ${DARK_MODE_MINT_TEXT} !important; }
      .email-header p { color: ${BRAND.teal} !important; }
      .email-table-label { background: ${DARK_MODE_MINT} !important; color: ${DARK_MODE_MINT_TEXT} !important; }
      .email-link { color: #B9D7B4 !important; }
      .email-content a:not(.email-button) { color: #B9D7B4 !important; }
      .email-logo-bar { background: #17221C !important; border-bottom-color: #8BB58D !important; }
      .email-button { background: #A9C7A6 !important; color: #10251D !important; }
      .email-callout { background: #20342A !important; border-left-color: #8BB58D !important; }
      .email-callout-info, .email-callout-success { background: #20342A !important; }
      .email-callout-warning { background: #3B2F18 !important; border-left-color: #E0A84F !important; }
      .email-callout-error { background: #3D2424 !important; border-left-color: #E78E8E !important; }
      .email-callout-title { color: #B9D7B4 !important; }
      .email-callout-warning .email-callout-title { color: #F3C56E !important; }
      .email-callout-error .email-callout-title { color: #FFB0B0 !important; }
      .email-content [style*="background: #F7F7F4"]:not(.email-table-label) { background: #203128 !important; }
      .email-message { background: #203128 !important; border-color: #2E4336 !important; }
      .email-status-box { background: #203128 !important; border-color: #2E4336 !important; }
      .email-status-label { color: #BAC8BE !important; }
      .email-status-value, .email-status-reviewing { color: #EFF7F0 !important; }
      .email-status-shortlisted { color: #D6C7FF !important; }
      .email-status-rejected { color: #FFB0B0 !important; }
      .email-status-hired { color: #B9E5D8 !important; }
      .email-code { background: #203128 !important; color: #EFF7F0 !important; }
      .email-content [style*="border: 1px solid #DFE6DC"],
      .email-content [style*="border-top: 1px solid #DFE6DC"] { border-color: #2E4336 !important; }
      .email-content hr[style*="border-top: 1px solid #DFE6DC"] { border-top-color: #2E4336 !important; }
      .email-content [style*="color: #66706A"] { color: #BAC8BE !important; }
      .email-content [style*="color: #10251D"]:not(.email-table-label) { color: #DCEBD9 !important; }
      .email-content [style*="color: #49634B"] { color: #B9D7B4 !important; }
    }
    [data-ogsc] .email-body, [data-ogsb] .email-body { background: #0F1713 !important; color: #EFF7F0 !important; }
    [data-ogsc] .email-card, [data-ogsb] .email-card,
    [data-ogsc] .email-content, [data-ogsb] .email-content,
    [data-ogsc] .email-surface, [data-ogsb] .email-surface { background: #17221C !important; border-color: #2E4336 !important; color: #EFF7F0 !important; }
    [data-ogsc] .email-header, [data-ogsb] .email-header { background: ${DARK_MODE_MINT} !important; border-bottom-color: ${DARK_MODE_MINT_BORDER} !important; }
    [data-ogsc] .email-header h1, [data-ogsb] .email-header h1 { color: ${DARK_MODE_MINT_TEXT} !important; }
    [data-ogsc] .email-header p, [data-ogsb] .email-header p { color: ${BRAND.teal} !important; }
    [data-ogsc] .email-message, [data-ogsb] .email-message { background: #203128 !important; border-color: #2E4336 !important; }
    [data-ogsc] .email-status-box, [data-ogsb] .email-status-box { background: #203128 !important; border-color: #2E4336 !important; }
    [data-ogsc] .email-status-label, [data-ogsb] .email-status-label { color: #BAC8BE !important; }
    [data-ogsc] .email-status-value, [data-ogsb] .email-status-value,
    [data-ogsc] .email-status-reviewing, [data-ogsb] .email-status-reviewing { color: #EFF7F0 !important; }
    [data-ogsc] .email-status-shortlisted, [data-ogsb] .email-status-shortlisted { color: #D6C7FF !important; }
    [data-ogsc] .email-status-rejected, [data-ogsb] .email-status-rejected { color: #FFB0B0 !important; }
    [data-ogsc] .email-status-hired, [data-ogsb] .email-status-hired { color: #B9E5D8 !important; }
    [data-ogsc] .email-code, [data-ogsb] .email-code { background: #203128 !important; color: #EFF7F0 !important; }
    [data-ogsc] .email-callout, [data-ogsb] .email-callout { background: #20342A !important; border-left-color: #8BB58D !important; }
    [data-ogsc] .email-callout-title, [data-ogsb] .email-callout-title { color: #B9D7B4 !important; }
    [data-ogsc] .email-callout-warning, [data-ogsb] .email-callout-warning { background: #3B2F18 !important; border-left-color: #E0A84F !important; }
    [data-ogsc] .email-callout-warning .email-callout-title, [data-ogsb] .email-callout-warning .email-callout-title { color: #F3C56E !important; }
    [data-ogsc] .email-callout-error, [data-ogsb] .email-callout-error { background: #3D2424 !important; border-left-color: #E78E8E !important; }
    [data-ogsc] .email-callout-error .email-callout-title, [data-ogsb] .email-callout-error .email-callout-title { color: #FFB0B0 !important; }
    [data-ogsc] .email-button, [data-ogsb] .email-button { background: #A9C7A6 !important; color: #10251D !important; }
    [data-ogsc] .email-logo-bar, [data-ogsb] .email-logo-bar { background: #17221C !important; border-bottom-color: #8BB58D !important; }
    [data-ogsc] .email-copy, [data-ogsb] .email-copy,
    [data-ogsc] .email-callout-body, [data-ogsb] .email-callout-body,
    [data-ogsc] .email-step, [data-ogsb] .email-step { color: #EFF7F0 !important; }
    [data-ogsc] .email-muted, [data-ogsb] .email-muted { color: #BAC8BE !important; }
    [data-ogsc] .email-section-title, [data-ogsb] .email-section-title { color: #DCEBD9 !important; }
    [data-ogsc] .email-table, [data-ogsb] .email-table { border-color: #2E4336 !important; }
    [data-ogsc] .email-table-label, [data-ogsb] .email-table-label { background: ${DARK_MODE_MINT} !important; color: ${DARK_MODE_MINT_TEXT} !important; }
    [data-ogsc] .email-table-value, [data-ogsb] .email-table-value { background: #17221C !important; color: #EFF7F0 !important; }
    [data-ogsc] .email-link, [data-ogsb] .email-link,
    [data-ogsc] .email-content a:not(.email-button), [data-ogsb] .email-content a:not(.email-button) { color: #B9D7B4 !important; }
  </style>
  <title>${esc(opts.headerTitle)}</title>
</head>
<body class="email-body body" bgcolor="${BRAND.paper}" style="margin:0; padding:0; background:${BRAND.paper}; color-scheme:light dark; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: ${BRAND.text};">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${esc(opts.preheader)}</div>

  <table class="email-shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.paper}" style="background:${BRAND.paper}; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table class="email-card email-surface" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.white}" style="max-width: 600px; width: 100%; background:${BRAND.white}; border-radius: 14px; overflow: hidden; border: 1px solid ${BRAND.border};">
          <tr>
            <td class="email-logo-bar" bgcolor="${BRAND.white}" style="background:${BRAND.white}; background-color:${BRAND.white}; padding: 20px 32px; text-align: center; border-bottom: 3px solid ${BRAND.teal};">
              <img class="email-logo-image" src="${getEmailLogoUrl()}" alt="SwiftJob" width="220" style="display:inline-block;max-width:220px;height:auto;border:0;border-radius:10px;background:#FFFFFF;" />
            </td>
          </tr>
          <tr>
            <td class="email-header" bgcolor="${BRAND.navy}" style="background:${BRAND.navy}; padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; color: ${BRAND.white}; font-size: 24px; font-weight: 700; letter-spacing: -0.2px;">${esc(opts.headerTitle)}</h1>
              ${opts.headerSubtitle ? `<p style="margin: 8px 0 0; color: ${BRAND.mint}; font-size: 14px;">${esc(opts.headerSubtitle)}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td class="email-content email-surface" bgcolor="${BRAND.white}" style="background:${BRAND.white}; padding: 32px;">
              ${opts.content}
            </td>
          </tr>
          <tr>
            <td class="email-footer" bgcolor="${BRAND.navy}" style="background:${BRAND.navy}; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 4px; color: ${BRAND.white}; font-size: 14px; font-weight: 600;">SwiftJob</p>
              <p style="margin: 0 0 12px; color: ${BRAND.mint}; font-size: 12px;">Remote opportunities with SwiftJob</p>
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

/** Shared branded template for administrator-authored messages. */
export function formatCustomEmailHtml(subject: string, body: string): string {
  const paragraphs = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p class="email-copy" style="margin:0 0 14px;color:${BRAND.text};font-size:15px;line-height:1.7;">${esc(line)}</p>`,
    )
    .join("");

  return layout({
    preheader: subject,
    headerTitle: subject,
    headerSubtitle: "A message from SwiftJob",
    content: `
      ${paragraphs}
      <p class="email-muted" style="margin:20px 0 0;color:${BRAND.muted};font-size:12.5px;line-height:1.6;">
        You received this message from SwiftJob. If you have any questions, contact us at
        <a class="email-link" href="mailto:${esc(getSupportEmail())}" style="color:${BRAND.teal};">${esc(getSupportEmail())}</a>.
      </p>
    `,
  });
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
    <div class="email-callout email-callout-${kind}" style="background:${s.bg}; border-left: 4px solid ${s.border}; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      <p class="email-callout-title" style="margin: 0 0 4px; color: ${s.title}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;">${esc(title)}</p>
      <div class="email-callout-body" style="margin: 0; font-size: 14px; color: ${BRAND.text};">${body}</div>
    </div>`;
}

function primaryButton(href: string, label: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a class="email-button" href="${esc(href)}" style="display: inline-block; background:${BRAND.teal}; color: ${BRAND.white}; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; letter-spacing: 0.2px;">${esc(label)}</a>
        </td>
      </tr>
    </table>`;
}

function sectionTitle(text: string): string {
  return `<h2 class="email-section-title" style="margin: 28px 0 12px; color: ${BRAND.navy}; font-size: 16px; font-weight: 700;">${esc(text)}</h2>`;
}

function infoRow(label: string, value: string): string {
  const gmailStableLabel = `<div class="gmail-blend-screen"><div class="gmail-blend-difference">${esc(label)}</div></div>`;
  return `
    <tr>
      <td class="email-table-label" style="padding: 10px 16px; border-top: 1px solid ${BRAND.border}; width: 40%; font-weight: 600; color: ${BRAND.navy}; font-size: 13px; background: ${BRAND.paper}; background-image: linear-gradient(${DARK_MODE_MINT}, ${DARK_MODE_MINT}); vertical-align: top;">${gmailStableLabel}</td>
      <td class="email-table-value" style="padding: 10px 16px; border-top: 1px solid ${BRAND.border}; font-size: 13px; color: ${BRAND.text}; vertical-align: top;">${value}</td>
    </tr>`;
}

function infoTable(rows: Array<[string, string]>): string {
  const body = rows.map(([label, value]) => infoRow(label, value)).join("");
  return `
    <table class="email-table" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin: 16px 0; border: 1px solid ${BRAND.border}; border-radius: 8px; overflow: hidden;">
      ${body}
    </table>`;
}

// ============================================
// Application notification (HR)
// ============================================
// ============================================
// Referral click notification (HR/admin)
// ============================================
export function formatReferralClickHtml(data: {
  fullName: string;
  referredBy?: string | null;
  position: string;
  referralCode: string;
  deviceType: string;
  clickedAt: Date;
}): string {
  const isMobile = data.deviceType === "mobile";
  const isDesktop = /^(desktop|laptop|pc)$/i.test(data.deviceType);
  const deviceLabel = isMobile
    ? "Mobile phone"
    : isDesktop
      ? "PC / laptop"
      : "Device not identified";
  const deviceColor = isMobile
    ? "#B45309"
    : isDesktop
      ? BRAND.green
      : BRAND.muted;
  const content = `
    <p class="email-copy" style="margin:0 0 12px;color:${BRAND.text};font-size:15px;line-height:1.7;">A referred lead clicked continue on their invitation page.</p>

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
        `<span class="email-status-value" style="font-weight:700;color:${deviceColor};">${deviceLabel}</span>`,
      ],
      [
        "Clicked",
        `<span>${esc(data.clickedAt.toISOString().replace("T", " ").slice(0, 16))} UTC</span>`,
      ],
    ])}

    ${
      isMobile
        ? callout(
            "warning",
            "Mobile device",
            `This click came from a ${deviceLabel}. The next step was <strong>blocked</strong> for them and they were asked to continue on a desktop/laptop. If this lead used a phone, they will open the page again from their PC — you may see a second click shortly.`,
          )
        : isDesktop
        ? callout(
            "success",
            "Laptop confirmed",
            `This lead is on a <strong>${deviceLabel}</strong> and was allowed through to the next step.`,
          )
        : callout(
            "info",
            "Device not identified",
            "The click was recorded, but the device could not be confirmed from the available browser signal.",
          )
    }

    <p class="email-muted" style="font-size:13px;color:${BRAND.muted};margin:8px 0 0;">Manage this referral in the <a class="email-link" href="${getBaseUrl()}/admin" style="color:${BRAND.teal};">admin dashboard</a>.</p>
  `;
  return layout({
    preheader: `Referral click: ${data.fullName} (${deviceLabel})`,
    headerTitle: "Referral Link Clicked",
    headerSubtitle: `${data.fullName} — ${data.position}`,
    content,
  });
}

export interface ApplicationEmailData {
  applicationId: string;
  position: string;
  fullName: string;
}

export function formatApplicationHtml(data: ApplicationEmailData): string {
  const content = `
    <p class="email-copy" style="margin:0 0 16px;color:${BRAND.text};font-size:15px;line-height:1.7;">A new application is ready for review.</p>
    ${infoTable([
      ["Candidate", esc(data.fullName)],
      ["Role", esc(data.position)],
      ["Application ID", esc(data.applicationId)],
    ])}
    <p class="email-muted" style="margin:0 0 16px;color:${BRAND.muted};font-size:13px;line-height:1.6;">The candidate's application and resume are available in the authorized admin record.</p>
    ${primaryButton(`${getBaseUrl()}/admin/applications?search=${encodeURIComponent(data.applicationId)}`, "Review application")}
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
export function formatConfirmationHtml(data: {
  position: string;
  fullName: string;
  applicationId: string;
  referenceCode?: string;
}): string {
  const referenceBlock = data.referenceCode
    ? `<p class="email-muted" style="margin:16px 0 0;color:${BRAND.muted};font-size:13px;line-height:1.6;">Reference: <strong class="email-code" style="background:${BRAND.paper};padding:3px 8px;border-radius:4px;color:${BRAND.text};">${esc(data.referenceCode)}</strong></p>`
    : "";

  const content = `
    <p class="email-copy" style="margin:0 0 12px;color:${BRAND.text};font-size:15px;line-height:1.7;">Hi <strong>${esc(data.fullName)}</strong>,</p>
    <p class="email-copy" style="margin:0 0 12px;color:${BRAND.text};font-size:15px;line-height:1.7;">We received your application for <strong>${esc(data.position)}</strong>. Our team aims to review it within 2–3 business days and will email you when its status changes.</p>
    ${callout("info", "What to do now", "Sign in to your candidate portal to complete the required technical check. If your application advances, any role assessment will appear there after the technical check is complete. Your progress is saved.")}
    ${primaryButton(`${getBaseUrl()}/login`, "Open candidate portal")}
    ${referenceBlock}
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
  nextSteps: string;
  color: string;
}

const STATUS_DETAILS: Record<string, StatusDetail> = {
  Reviewing: {
    color: "#1D4ED8",
    message: "Your application is being reviewed by our recruitment team.",
    nextSteps: "No action is needed right now. We will email you when there is an update.",
  },
  Shortlisted: {
    color: "#6D28D9",
    message: "Your application has moved to the next stage.",
    nextSteps: "Sign in to your candidate portal to see the next step. Any required role assessment becomes available after you complete the technical check. Your progress is saved.",
  },
  Rejected: {
    color: "#B91C1C",
    message: "Thank you for your interest in this role.",
    nextSteps: "We have decided to move forward with other candidates for this role. Thank you for the time you invested in applying.",
  },
  Hired: {
    color: "#0F766E",
    message: "Your application has been marked as hired.",
    nextSteps: "Our team will contact you with the next steps.",
  },
};

export function formatStatusUpdateHtml(data: {
  fullName: string;
  position: string;
  status: string;
  message: string;
  referenceCode?: string;
}): string {
  const detail = STATUS_DETAILS[data.status];
  const statusColor = detail?.color ?? BRAND.teal;
  const statusClass = ({
    Reviewing: "reviewing",
    Shortlisted: "shortlisted",
    Rejected: "rejected",
    Hired: "hired",
  } as Record<string, string>)[data.status] ?? "other";

  const referenceBlock = data.referenceCode
    ? `<p class="email-muted" style="font-size:13px;color:${BRAND.muted};margin:16px 0 0;">Reference: <strong class="email-code" style="background:${BRAND.paper};padding:3px 8px;border-radius:4px;color:${BRAND.text};">${esc(data.referenceCode)}</strong></p>`
    : "";

  const statusBox = `
    <div class="email-status-box" style="background:${BRAND.paper};border-radius:8px;padding:20px;margin:20px 0;text-align:center;border:1px solid ${BRAND.border};">
      <p class="email-status-label" style="margin:0 0 6px;color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Application status</p>
      <p class="email-status-value email-status-${statusClass}" style="margin:0;font-size:24px;font-weight:700;color:${statusColor};">${esc(data.status)}</p>
    </div>`;

  const nextSteps = detail
    ? callout("info", "What happens next", detail.nextSteps)
    : callout("info", "What happens next", esc(data.message));

  const content = `
    <p class="email-copy" style="margin:0 0 12px;color:${BRAND.text};font-size:15px;line-height:1.7;">Hi <strong>${esc(data.fullName)}</strong>,</p>
    <p class="email-copy" style="margin:0 0 12px;color:${BRAND.text};font-size:15px;line-height:1.7;">There is an update on your application for <strong>${esc(data.position)}</strong>.</p>
    ${statusBox}
    <p class="email-copy" style="margin:0 0 12px;color:${BRAND.text};font-size:15px;line-height:1.7;"><strong>${esc(detail?.message ?? data.message)}</strong></p>
    ${nextSteps}
    ${primaryButton(`${getBaseUrl()}/login`, "View application")}
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
export function formatContactHtml(data: {
  firstName: string;
  email: string;
  interest: string;
  message: string;
}): string {
  const content = `
    <p class="email-copy" style="margin: 0 0 12px; font-size: 15px;">A new message was submitted through the contact form on the SwiftJob website.</p>

    ${infoTable([
      ["Name", esc(data.firstName)],
      [
        "Email",
        `<a href="mailto:${esc(data.email)}" style="color: ${BRAND.teal};">${esc(data.email)}</a>`,
      ],
      ["Interest", esc(data.interest)],
    ])}

    ${sectionTitle("Message")}
    <p class="email-copy email-message" style="background: ${BRAND.paper}; padding: 14px 16px; border-radius: 8px; border: 1px solid ${BRAND.border}; white-space: pre-wrap; margin: 0; font-size: 13px;">${esc(data.message)}</p>

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
export function formatMagicLinkHtml(data: {
  linkUrl: string;
  fullName?: string;
}): string {
  const greeting = data.fullName
    ? `Hi <strong>${esc(data.fullName)}</strong>,`
    : "Hi there,";
  const content = `
    <p class="email-copy" style="margin:0 0 12px;color:${BRAND.text};font-size:15px;line-height:1.7;">${greeting}</p>
    <p class="email-copy" style="margin:0 0 12px;color:${BRAND.text};font-size:15px;line-height:1.7;">Use this one-time link to sign in to your candidate portal and view your applications.</p>
    ${primaryButton(data.linkUrl, "Sign in to my portal")}
    ${callout("warning", "Expires in 15 minutes", "This link can be used once. If it expires, request a new sign-in link.")}
    <p class="email-muted" style="font-size:13px;color:${BRAND.muted};word-break:break-all;margin:16px 0 0;">If the button does not work, copy this link into your browser:<br><a class="email-link" href="${esc(data.linkUrl)}" style="color:${BRAND.teal};">${esc(data.linkUrl)}</a></p>
    <p class="email-muted" style="font-size:13px;color:${BRAND.muted};margin:16px 0 0;">If you did not request this link, you can ignore this email.</p>
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
export function formatReferralInvitationHtml(data: {
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
    <p class="email-copy" style="margin:0 0 12px;color:${BRAND.text};font-size:15px;line-height:1.7;">${esc(data.content.emailGreeting ?? `Hi ${data.fullName},`)}</p>
    <p class="email-copy" style="margin:0 0 4px;color:${BRAND.text};font-size:15px;line-height:1.7;white-space:pre-wrap;">${esc(body)}</p>

    ${primaryButton(data.referralUrl, data.content.emailCtaLabel ?? "Open my briefing")}

    <p class="email-copy" style="font-size:14px;color:${BRAND.text};line-height:1.7;margin:0 0 12px;white-space:pre-wrap;">${esc(data.content.emailClosing ?? "When you're ready, just follow the steps inside.")}</p>

    <hr style="border: none; border-top: 1px solid ${BRAND.border}; margin: 24px 0;">
    <p class="email-muted" style="font-size:13px;color:${BRAND.muted};margin:0;">
      This invitation is intended for you. Questions? Reply to this email or contact <a class="email-link" href="mailto:${esc(getSupportEmail())}" style="color: ${BRAND.teal};">${esc(getSupportEmail())}</a>.
    </p>
  `;

  return layout({
    preheader: `Your referral briefing from SwiftJob`,
    headerTitle: "You've been referred",
    headerSubtitle: data.position,
    content,
  });
}

export function formatTechCheckCompletionHtml(data: {
  applicationId: string;
  referenceCode: string;
  fullName: string;
  position: string;
}): string {
  const adminUrl = `${getBaseUrl()}/admin/applications?search=${encodeURIComponent(data.applicationId)}`;
  const content = `
    <p class="email-copy" style="margin:0 0 16px;color:${BRAND.text};font-size:15px;line-height:1.7;">A candidate has completed the technical check.</p>
    ${infoTable([
      ["Candidate", esc(data.fullName)],
      ["Role", esc(data.position)],
      ["Reference", esc(data.referenceCode)],
      ["Application ID", esc(data.applicationId)],
    ])}
    ${primaryButton(adminUrl, "Review application")}
    <p class="email-muted" style="margin:16px 0 0;color:${BRAND.muted};font-size:12.5px;line-height:1.6;">The full report is available only in the authorized application record.</p>
  `;
  return layout({
    preheader: `${data.fullName} completed the technical check for ${data.position}`,
    headerTitle: "Technical Check Completed",
    headerSubtitle: `${data.fullName} — ${data.position}`,
    content,
  });
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
    referenceCode?: string;
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

  async sendTechCheckCompletionNotification(data: {
    applicationId: string;
    referenceCode: string;
    fullName: string;
    position: string;
  }): Promise<void> {
    await sendEmail({
      from: getFromAddress(),
      to: getHrEmail(),
      subject: `Technical check completed: ${data.position} — ${data.fullName} (${data.referenceCode})`,
      html: formatTechCheckCompletionHtml(data),
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
