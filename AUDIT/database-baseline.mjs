import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../workers-api/package.json', import.meta.url));
const { neon } = require('@neondatabase/serverless');
const text = await fs.readFile(new URL('../workers-api/.dev.vars', import.meta.url), 'utf8');
const url = text.match(/^DATABASE_URL\s*=\s*(.*)$/m)?.[1].trim().replace(/^["']|["']$/g,'');
const result = { readOnly: true, connectivity: 'NOT VERIFIED', schema: [], aggregates: [] };
try {
  const sql = neon(url);
  result.schema = await sql("SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position");
  result.connectivity = 'VERIFIED';
  result.constraints = await sql("SELECT conrelid::regclass::text AS table_name, conname, contype, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conrelid::regclass::text, conname");
  result.indexes = await sql("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname");
  result.aggregates = await sql("SELECT 'jobs' AS entity,count(*)::int AS count FROM jobs UNION ALL SELECT 'applications',count(*)::int FROM applications UNION ALL SELECT 'candidate_accounts',count(*)::int FROM candidate_accounts");
  result.duplicates = await sql("SELECT count(*)::int AS duplicate_groups FROM (SELECT lower(trim(email)),position,count(*) FROM applications GROUP BY lower(trim(email)),position HAVING count(*)>1) duplicates");
} catch (error) { result.error = { name: error.name, code: error.code ?? null }; }
await fs.writeFile(new URL('./evidence/database-baseline.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({connectivity:result.connectivity,tables:[...new Set(result.schema.map(v=>v.table_name))],aggregates:result.aggregates,duplicates:result.duplicates,error:result.error},null,2));
