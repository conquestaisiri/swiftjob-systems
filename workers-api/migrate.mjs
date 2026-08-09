// Runs SQL migrations against a Neon database.
// Usage: DATABASE_URL=<neon-connection-string> node migrate.mjs [path/to/migration.sql]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  console.error('Example: DATABASE_URL="postgresql://..." node migrate.mjs');
  process.exit(1);
}

const fileArg = process.argv[2];
const defaultFile = new URL(
  "./migrations/001_init.sql",
  import.meta.url,
).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const file = fileArg ? resolve(fileArg) : defaultFile;

const sql = readFileSync(file, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("--"))
  .join("\n");

const sqlClient = neon(DATABASE_URL);
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .map((s) =>
    s
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("--"))
      .join("\n"),
  )
  .filter((s) => s.length > 0);

console.log(`Running ${statements.length} statements from ${file}`);

let ok = 0;
let failed = 0;
for (const statement of statements) {
  try {
    await sqlClient(statement);
    ok++;
    console.log(`  OK: ${statement.split("\n")[0].slice(0, 80)}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${statement.slice(0, 120)}`);
    console.error(`         ${err.message}`);
  }
}

console.log(`\nDone. ${ok} succeeded, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
