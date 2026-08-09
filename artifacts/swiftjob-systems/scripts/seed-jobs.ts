import { JOBS } from "../src/data/jobs";

const API_BASE = process.env.SEED_API_URL || "https://swiftjob.payservice.top";
const ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL || "admin@swiftjob.payservice.top";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "";

if (!ADMIN_PASSWORD) {
  console.error("Set SEED_ADMIN_PASSWORD");
  process.exit(1);
}

console.log(`Loaded ${JOBS.length} jobs from jobs.ts`);
if (JOBS.length !== 43) {
  console.error(`Expected 43 jobs, got ${JOBS.length}. Aborting.`);
  process.exit(1);
}

const loginRes = await fetch(`${API_BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
});
if (!loginRes.ok) {
  console.error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  process.exit(1);
}
const { token } = (await loginRes.json()) as { token: string };
console.log("Admin login OK");

let created = 0;
let failed = 0;
for (const job of JOBS) {
  const res = await fetch(`${API_BASE}/api/admin/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(job),
  });
  if (res.ok) {
    created++;
    console.log(`  + ${job.slug}`);
  } else {
    failed++;
    console.log(`  ! ${job.slug} -> ${res.status} ${await res.text()}`);
  }
}

console.log(`\nDone. Created ${created}, failed ${failed}.`);
