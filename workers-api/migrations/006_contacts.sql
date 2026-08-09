-- SwiftJob - contacts table
-- Stores imported contact/lead records (name, email, phone, address, postal code).
-- All data columns are nullable so incomplete records can be stored as-is.

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  full_name text,
  email text,
  phone text,
  address text,
  postal_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_full_name ON contacts (full_name);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_postal_code ON contacts (postal_code);
