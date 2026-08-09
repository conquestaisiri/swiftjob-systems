-- SwiftJob - referral system
-- Adds tables for managing referrals (leads), editable referral page content,
-- and admin settings for daily send limits.

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text,
  referred_by text,
  job_title text,
  meeting_url text,
  status text NOT NULL DEFAULT 'Pending',
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Editable sections of the /referral/:code landing page AND the referral email.
-- Each row is a content block the admin can edit in the dashboard.
CREATE TABLE IF NOT EXISTS referral_content (
  key text PRIMARY KEY,
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Admin settings for referrals.
CREATE TABLE IF NOT EXISTS referral_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_send_limit integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default settings.
INSERT INTO referral_settings (id, daily_send_limit) VALUES (1, 5)
ON CONFLICT (id) DO NOTHING;

-- Seed default page + email content (admin can edit these anytime).
INSERT INTO referral_content (key, body) VALUES
  ('heroTitle', 'You''ve been referred'),
  ('heroSubtitle', 'A private opportunity from SwiftJob'),
  ('intro', 'Hi {name}, you''ve been referred by someone on our team. We received your referral and you''ve been selected to review this opportunity. Please read through everything below, then take your next step.'),
  ('aboutRoleTitle', 'About the role'),
  ('aboutRoleBody', 'We run this role remotely and on your own schedule, from your own laptop. This is a {position} role.'),
  ('whatYouDoTitle', 'What you''ll be doing'),
  ('whatYouDoBody', 'You''ll be part of a small team handling day-to-day tasks for the role. Full training and support are provided — you don''t need any special software or experience to get started.'),
  ('payTitle', 'Pay & earnings'),
  ('payBody', 'Pay is clear and predictable. You''ll be given exact details during your onboarding call, including your rate and how and when you''ll be paid.'),
  ('howWorksTitle', 'How it works'),
  ('howWorksBody', 'Everything happens from your laptop, working from home. It''s a Q&A-style setup powered by simple guidance we share with you — not an interview for a traditional office job.'),
  ('getStartedTitle', 'Your next step'),
  ('getStartedBody', 'When you''re ready, use the button below to continue. Please complete this on the laptop you''ll use for the role.'),
  ('ctaLabel', 'Continue to your next step'),
  ('supportTitle', 'Need help?'),
  ('supportBody', 'If anything here isn''t responding or you have any questions, contact us right away and we''ll help.'),
  ('securityNote', 'This invitation is private to you. Only use links shared through this page or in your invitation email.'),
  ('emailSubject', 'You''ve been referred for a {position} role'),
  ('emailGreeting', 'Hi {name},'),
  ('emailBody', 'Someone from SwiftJob referred you, and we''d love for you to review this opportunity. We open a limited number of spots each week, and you''ve been selected to review this one.'),
  ('emailCtaLabel', 'Open my invitation'),
  ('emailClosing', 'We''ve put everything you need on the page below — the role, how it works, and what''s next. When you''re ready, just follow the steps inside.')
ON CONFLICT (key) DO NOTHING;