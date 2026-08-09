-- SwiftJob - shortlist meeting key column
-- Adds a column for storing the private access code/key for the SwiftJob
-- private meeting platform. The key is surfaced to the candidate only
-- through their portal, never in the status email.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS meeting_key text;
