import { readFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
const { neon } = createRequire(new URL("../workers-api/package.json", import.meta.url))("@neondatabase/serverless");
const { SignJWT } = createRequire(new URL("../workers-api/package.json", import.meta.url))("jose");

const vars = await readFile(new URL("../workers-api/.dev.vars", import.meta.url), "utf8");
const access = await readFile(new URL("file:///C:/Users/USER/Desktop/SWIFTJOB-ALL-ACCOUNT-ACCESS-KEYS.env"), "utf8").catch(() => "");
const get = (name) => {
  const line = (vars + "\n" + access).split(/\r?\n/).find((row) => new RegExp(`^${name}\\s*=`).test(row));
  return line?.slice(line.indexOf("=") + 1).trim().replace(/^"|"$/g, "");
};
const databaseUrl = get("DATABASE_URL");
const secret = get("JWT_SECRET");
if (!databaseUrl || !secret) throw new Error("Required local test environment values are missing");
const sql = neon(databaseUrl);
const email = "live-referral-owner@example.test";
const sessionToken = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
const bearer = await new SignJWT({ sessionToken, email, role: "candidate" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h")
  .sign(new TextEncoder().encode(secret));
try {
  await sql`DELETE FROM candidate_referrals WHERE owner_email = ${email}`;
  await sql`DELETE FROM candidate_referral_links WHERE owner_email = ${email}`;
  await sql`DELETE FROM candidate_profiles WHERE email = ${email}`;
  await sql`INSERT INTO candidate_sessions (email, token_hash, expires_at) VALUES (${email}, ${tokenHash}, now() + interval '1 hour')`;
  const headers = { Authorization: `Bearer ${bearer}` };
  const profile = await fetch("https://swiftjob.online/api/candidate/profile", { headers });
  if (profile.status !== 200) throw new Error(`Profile GET returned ${profile.status}`);
  const list = await fetch("https://swiftjob.online/api/candidate/referrals", { headers });
  const listBody = await list.json();
  if (list.status !== 200 || !Array.isArray(listBody.links) || listBody.links.length < 1) throw new Error(`Referral list returned ${list.status}`);
  const general = listBody.links.find((link) => !link.jobSlug);
  if (!general || general.rewardCents !== null || general.rewardRangeCents?.min !== 4000 || general.rewardRangeCents?.max !== 10000) {
    throw new Error("General referral link did not expose the $40–$100 range");
  }
  const created = await fetch("https://swiftjob.online/api/candidate/referrals", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ jobSlug: "captioner-subtitler" }) });
  const createdBody = await created.json();
  if (created.status !== 201 || createdBody.link?.rewardCents !== 4000) throw new Error(`Referral create returned ${created.status}`);
  const publicResponse = await fetch(`https://swiftjob.online/api/candidate-referrals/${createdBody.link.code}`);
  if (publicResponse.status !== 200) throw new Error(`Public handoff returned ${publicResponse.status}`);
  const publicBody = await publicResponse.json();
  if (publicBody.rewardCents !== 4000 || publicBody.rewardRangeCents?.min !== 4000 || publicBody.rewardRangeCents?.max !== 10000) {
    throw new Error("Role referral handoff returned an unexpected reward");
  }
  console.log(JSON.stringify({ status: "PASS", profile: profile.status, list: list.status, create: created.status, publicHandoff: publicResponse.status, generalRange: general.rewardRangeCents, roleRewardCents: publicBody.rewardCents }));
} finally {
  await sql`DELETE FROM candidate_referrals WHERE owner_email = ${email}`;
  await sql`DELETE FROM candidate_referral_links WHERE owner_email = ${email}`;
  await sql`DELETE FROM candidate_profiles WHERE email = ${email}`;
  await sql`DELETE FROM candidate_sessions WHERE email = ${email}`;
}
