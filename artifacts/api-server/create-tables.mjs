import { Client } from 'pg';
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set before running this retired migration helper.');
}
const client = new Client({ connectionString });

async function run() {
  await client.connect();
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS magic_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);
  console.log('magic_tokens created');

  await client.query(`
    CREATE TABLE IF NOT EXISTS candidate_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      last_used_at TIMESTAMPTZ,
      revoked BOOLEAN DEFAULT FALSE NOT NULL
    )
  `);
  console.log('candidate_sessions created');

  await client.end();
}

run().catch(e => console.error('Error:', e.message));
