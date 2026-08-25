export interface Env {
  DATABASE_URL: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  HR_EMAIL: string;
  SUPPORT_EMAIL?: string;
  JWT_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  FRONTEND_URL: string;
  TURNSTILE_SECRET_KEY?: string;
  R2_BUCKET: R2Bucket;
  // Backblaze B2 — private MSI storage for the combined installer (Option A)
  // Bucket holds SwiftTechCheck.msi (7.1MB). Keys stay server-side, signed URLs are 15-min.
  B2_KEY_ID?: string;
  B2_APP_KEY?: string;
  B2_BUCKET_ID?: string;
  B2_BUCKET_NAME?: string;
  B2_API_URL?: string;
  B2_DOWNLOAD_URL?: string;
}
