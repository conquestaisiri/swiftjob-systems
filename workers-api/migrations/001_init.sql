-- SwiftJob - Neon database schema
-- Run this against your Neon database to create all tables.
-- Compatible with the Drizzle schema in workers-api/src/schema.ts

-- Application status enum
CREATE TYPE application_status AS ENUM ('New', 'Reviewing', 'Shortlisted', 'Rejected', 'Hired');

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  position text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  timezone text NOT NULL,
  linkedin_url text,
  portfolio_url text,
  years_experience text NOT NULL,
  education text NOT NULL,
  english_proficiency text NOT NULL,
  notice_period text NOT NULL,
  expected_salary text NOT NULL,
  earliest_start_date text NOT NULL,
  skills text NOT NULL,
  relevant_experience text NOT NULL,
  cover_letter text NOT NULL,
  resume_path text,
  resume_filename text,
  status application_status NOT NULL DEFAULT 'New',
  reference_code text NOT NULL UNIQUE
);

-- Index for fast lookup by email (candidate portal)
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications (email);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications (created_at DESC);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  department text NOT NULL,
  employment_type text NOT NULL,
  work_arrangement text NOT NULL,
  experience_level text NOT NULL,
  experience text NOT NULL,
  compensation text NOT NULL,
  posted_date text NOT NULL,
  summary text NOT NULL,
  overview text NOT NULL,
  responsibilities text[] NOT NULL DEFAULT '{}',
  required_qualifications text[] NOT NULL DEFAULT '{}',
  preferred_qualifications text[] NOT NULL DEFAULT '{}',
  skills text[] NOT NULL DEFAULT '{}',
  software_tools text[] NOT NULL DEFAULT '{}',
  benefits text[] NOT NULL DEFAULT '{}',
  working_hours text NOT NULL,
  hiring_process text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Magic link tokens (candidate auth)
CREATE TABLE IF NOT EXISTS magic_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic_tokens_email ON magic_tokens (email);

-- Candidate sessions (7-day session tokens, stored hashed)
CREATE TABLE IF NOT EXISTS candidate_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_candidate_sessions_email ON candidate_sessions (email);
