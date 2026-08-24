import { jobRepository } from "../repositories";
import type { CreateJobInput, Job } from "../schema";

const REQUIRED_FIELDS = [
  "title",
  "department",
  "employmentType",
  "workArrangement",
  "experienceLevel",
  "experience",
  "compensation",
  "postedDate",
  "summary",
  "overview",
  "workingHours",
] as const;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    // Split on newlines only — commas are legitimate inside list items
    // ("Health, dental & vision") and must not explode into fake bullets.
    return value
      .split(/\n/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export interface NormalizedJob {
  slug: string;
  title: string;
  department: string;
  employmentType: string;
  workArrangement: string;
  experienceLevel: string;
  experience: string;
  compensation: string;
  postedDate: string;
  summary: string;
  overview: string;
  responsibilities: string[];
  requiredQualifications: string[];
  preferredQualifications: string[];
  skills: string[];
  softwareTools: string[];
  benefits: string[];
  workingHours: string;
  hiringProcess: string[];
  isActive: boolean;
}

function normalizeInput(body: Record<string, unknown>): NormalizedJob {
  for (const field of REQUIRED_FIELDS) {
    const value = typeof body[field] === "string" ? body[field].trim() : "";
    if (!value) {
      throw new ValidationError(`Missing required field: ${field}`);
    }
  }

  const title = String(body.title).trim();
  const slug =
    typeof body.slug === "string" && body.slug.trim()
      ? slugify(body.slug)
      : slugify(title);

  if (!slug) {
    throw new ValidationError("Unable to generate a slug from the title");
  }

  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

  return {
    slug,
    title,
    department: String(body.department).trim(),
    employmentType: String(body.employmentType).trim(),
    workArrangement: String(body.workArrangement).trim(),
    experienceLevel: String(body.experienceLevel).trim(),
    experience: String(body.experience).trim(),
    compensation: String(body.compensation).trim(),
    postedDate: String(body.postedDate).trim(),
    summary: String(body.summary).trim(),
    overview: String(body.overview).trim(),
    responsibilities: toList(body.responsibilities),
    requiredQualifications: toList(body.requiredQualifications),
    preferredQualifications: toList(body.preferredQualifications),
    skills: toList(body.skills),
    softwareTools: toList(body.softwareTools),
    benefits: toList(body.benefits),
    workingHours: String(body.workingHours).trim(),
    hiringProcess: toList(body.hiringProcess),
    isActive,
  };
}

export class ValidationError extends Error {}

export const jobService = {
  async listPublic(): Promise<Job[]> {
    return jobRepository.findAll(false);
  },

  async getBySlug(slug: string): Promise<Job | undefined> {
    return jobRepository.findBySlug(slug, false);
  },

  async listAdmin(): Promise<Job[]> {
    return jobRepository.findAll(true);
  },

  async getById(id: string): Promise<Job | undefined> {
    return jobRepository.findById(id);
  },

  async create(body: Record<string, unknown>): Promise<Job> {
    const normalized = normalizeInput(body);
    const existing = await jobRepository.findBySlug(normalized.slug, true);
    if (existing) {
      throw new ValidationError("A job with this slug already exists");
    }
    return jobRepository.create(normalized as CreateJobInput);
  },

  async update(
    id: string,
    body: Record<string, unknown>,
  ): Promise<Job | undefined> {
    const existing = await jobRepository.findById(id);
    if (!existing) return undefined;

    const normalized = normalizeInput(body);

    if (normalized.slug !== existing.slug) {
      const slugTaken = await jobRepository.findBySlug(normalized.slug, true);
      if (slugTaken) {
        throw new ValidationError("A job with this slug already exists");
      }
    }

    return jobRepository.update(id, normalized as CreateJobInput);
  },

  async delete(id: string): Promise<boolean> {
    return jobRepository.delete(id);
  },
};
