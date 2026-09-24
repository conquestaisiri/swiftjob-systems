import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const { neon } = createRequire(new URL("../workers-api/package.json", import.meta.url))("@neondatabase/serverless");

const vars = await readFile(new URL("../workers-api/.dev.vars", import.meta.url), "utf8");
const databaseUrl = vars.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
if (!databaseUrl) throw new Error("DATABASE_URL missing from workers-api/.dev.vars");
const sql = neon(databaseUrl);
const code = "SJREF-TEST1234";
const owner = "live-smoke-owner@example.test";
const keep = process.argv.includes("--keep");
try {
  await sql`DELETE FROM candidate_referrals WHERE link_code = ${code}`;
  await sql`DELETE FROM candidate_referral_links WHERE code = ${code}`;
  await sql`INSERT INTO candidate_referral_links (owner_email, code, job_slug) VALUES (${owner}, ${code}, 'captioner-subtitler')`;
  const response = await fetch(`https://swiftjob.online/api/candidate-referrals/${code}`);
  const body = await response.json();
  if (response.status !== 200 || body.code !== code || !Number.isInteger(body.rewardCents)) {
    throw new Error(`Unexpected public referral response (${response.status})`);
  }
  console.log(JSON.stringify({ status: "PASS", publicReferral: response.status, rewardCents: body.rewardCents }));
} finally {
  if (!keep) {
    await sql`DELETE FROM candidate_referrals WHERE link_code = ${code}`;
    await sql`DELETE FROM candidate_referral_links WHERE code = ${code}`;
  }
}
