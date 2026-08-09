-- SwiftJob - next step flow (silent background load + room reveal)
-- Adds per-application next-step configuration on top of the global
-- defaults that live in referral_content (auto-seeded by the worker).
--
-- The public "Next step" flow:
--   1. Candidate clicks "Continue" on their referral/candidate page (PC only).
--   2. The configured background website loads silently for a few seconds.
--   3. After `next_step_delay` seconds the candidate's unique room link is
--      revealed and they open it themselves.
--
-- Applications can override the global values per candidate; empty cells
-- fall back to the global defaults (referral_content keys).

ALTER TABLE applications ADD COLUMN IF NOT EXISTS background_url text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS room_link text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS next_step_delay integer;

-- Global next-step defaults. Left blank so existing pages keep the old
-- behaviour (instant open) until the admin configures them.
INSERT INTO referral_content (key, body) VALUES
  ('backgroundUrl', ''),
  ('roomLink', ''),
  ('nextStepDelay', '12'),
  ('waitTitle', 'Preparing your room'),
  ('waitBody', 'Give us a few seconds while we get everything ready for you…'),
  ('readyTitle', 'Your room is ready'),
  ('readyBody', 'Your unique room link is below. Open it now to continue.'),
  ('openRoomLabel', 'Open my room'),
  ('roomNote', 'Keep this page open until your room loads.')
ON CONFLICT (key) DO NOTHING;