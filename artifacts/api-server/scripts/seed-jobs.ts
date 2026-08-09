import { db } from "@workspace/db";
import { jobs } from "@workspace/db/schema";
import { JOBS } from "../../swiftjob-systems/src/data/jobs.ts";

async function main() {
  const existing = await db.select({ slug: jobs.slug }).from(jobs);
  const existingSlugs = new Set(existing.map((r) => r.slug));

  let inserted = 0;
  let skipped = 0;

  for (const j of JOBS) {
    if (existingSlugs.has(j.slug)) {
      skipped += 1;
      continue;
    }
    await db.insert(jobs).values({
      slug: j.slug,
      title: j.title,
      department: j.department,
      employmentType: j.employmentType,
      workArrangement: j.workArrangement,
      experienceLevel: j.experienceLevel,
      experience: j.experience,
      compensation: j.compensation,
      postedDate: j.postedDate,
      summary: j.summary,
      overview: j.overview,
      responsibilities: j.responsibilities,
      requiredQualifications: j.requiredQualifications,
      preferredQualifications: j.preferredQualifications,
      skills: j.skills,
      softwareTools: j.softwareTools,
      benefits: j.benefits,
      workingHours: j.workingHours,
      hiringProcess: j.hiringProcess,
      isActive: true,
    });
    inserted += 1;
  }

  console.log(`Seed complete: ${inserted} inserted, ${skipped} skipped.`);
  await db.$client.end?.();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
