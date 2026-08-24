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
}
