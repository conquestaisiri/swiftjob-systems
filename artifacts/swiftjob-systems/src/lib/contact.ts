// Public contact addresses. Configure via VITE_SUPPORT_EMAIL and
// VITE_CAREERS_EMAIL; these fallbacks match the API defaults.
export const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ??
  "support@swiftjob.payservice.top";

export const CAREERS_EMAIL =
  (import.meta.env.VITE_CAREERS_EMAIL as string | undefined) ??
  "careers@swiftjob.payservice.top";
