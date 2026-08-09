-- SwiftJob - shortlist interview columns
-- Adds columns for storing the Google Meet link and interview instructions
-- when an application is shortlisted. The link is surfaced to the candidate
-- only through their portal, never in the status email.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS meet_link text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_instructions text;
