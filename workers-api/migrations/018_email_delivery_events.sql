-- Minimal Resend delivery telemetry with durable hard-bounce/complaint
-- suppression. Raw webhook bodies and engagement events are not retained.
CREATE TABLE IF NOT EXISTS email_delivery_events (
  provider_event_id text PRIMARY KEY,
  email_id text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_delivery_events_occurred_at_idx
  ON email_delivery_events (occurred_at);

CREATE TABLE IF NOT EXISTS email_provider_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('permanent_bounce', 'spam_complaint')),
  source_event_id text NOT NULL,
  suppressed_at timestamptz NOT NULL DEFAULT now()
);
