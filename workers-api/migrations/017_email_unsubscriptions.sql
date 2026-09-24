-- Optional outreach must honor a persistent recipient opt-out.
CREATE TABLE IF NOT EXISTS email_unsubscriptions (
  email text PRIMARY KEY,
  source text NOT NULL DEFAULT 'outreach_link',
  unsubscribed_at timestamptz NOT NULL DEFAULT now()
);
