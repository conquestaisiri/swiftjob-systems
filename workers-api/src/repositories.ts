import { getDb } from "./db";
import {
  applications,
  magicTokens,
  candidateSessions,
  jobs,
  referrals,
  referralClicks,
  referralContent,
  referralSettings,
  contacts,
  footprints,
  activities,
  campaigns,
  campaignVisits,
} from "./schema";
import {
  eq,
  and,
  or,
  ne,
  gt,
  gte,
  lt,
  desc,
  asc,
  ilike,
  sql,
  inArray,
  isNotNull,
  isNull,
  exists,
  count as drizzleCount,
} from "drizzle-orm";
import type {
  Application,
  CreateApplicationInput,
  ApplicationStatus,
  MagicToken,
  CreateMagicTokenInput,
  CandidateSession,
  CreateCandidateSessionInput,
  Job,
  CreateJobInput,
  CreateReferralInput,
  Referral,
  ReferralSettingsRow,
  Contact,
  CreateContactInput,
  Footprint,
  Activity,
  CreateActivityInput,
  Campaign,
  CreateCampaignInput,
} from "./schema";
import type { SQL } from "drizzle-orm";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Cryptographically secure random character from CHARSET. These codes guard
// private briefing pages, so Math.random() (predictable, state-recoverable)
// must never be used.
function randomCharsetChar(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return CHARSET[bytes[0] % CHARSET.length];
}

function generateReferenceCode(): string {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    let segment = "";
    for (let j = 0; j < 4; j++) {
      segment += randomCharsetChar();
    }
    parts.push(segment);
  }
  return parts.join("-");
}

export const applicationRepository = {
  async create(input: CreateApplicationInput): Promise<Application> {
    const db = getDb();
    let referenceCode: string;
    let attempts = 0;
    do {
      referenceCode = generateReferenceCode();
      const exists = await db
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.referenceCode, referenceCode))
        .limit(1);
      if (exists.length === 0) break;
      attempts++;
    } while (attempts < 5);

    const [result] = await db
      .insert(applications)
      .values({ ...input, referenceCode })
      .returning();
    return result;
  },

  async findByEmail(email: string): Promise<Application[]> {
    const db = getDb();
    // Case-insensitive: apply-form input is stored verbatim, magic-link login
    // lowercases. Without this, John@Example.com signs in to an empty portal.
    return db
      .select()
      .from(applications)
      .where(sql`lower(${applications.email}) = ${email.toLowerCase().trim()}`)
      .orderBy(desc(applications.createdAt));
  },

  async findByReferenceCode(
    referenceCode: string,
  ): Promise<Application | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(applications)
      .where(eq(applications.referenceCode, referenceCode))
      .limit(1);
    return result;
  },

  async findById(id: string): Promise<Application | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1);
    return result;
  },

  async findAll(): Promise<Application[]> {
    const db = getDb();
    return db.select().from(applications).orderBy(desc(applications.createdAt));
  },

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    meetLink?: string | null,
    interviewInstructions?: string | null,
    meetingKey?: string | null,
    nextStep?: {
      backgroundUrl?: string | null;
      roomLink?: string | null;
      nextStepDelay?: number | null;
    },
  ): Promise<boolean> {
    const db = getDb();
    const result = await db
      .update(applications)
      .set({
        status,
        ...(meetLink !== undefined ? { meetLink } : {}),
        ...(interviewInstructions !== undefined
          ? { interviewInstructions }
          : {}),
        ...(meetingKey !== undefined ? { meetingKey } : {}),
        ...(nextStep?.backgroundUrl !== undefined
          ? { backgroundUrl: nextStep.backgroundUrl || null }
          : {}),
        ...(nextStep?.roomLink !== undefined
          ? { roomLink: nextStep.roomLink || null }
          : {}),
        ...(nextStep?.nextStepDelay !== undefined
          ? { nextStepDelay: nextStep.nextStepDelay || null }
          : {}),
      })
      .where(eq(applications.id, id))
      .returning({ id: applications.id });
    return result.length > 0;
  },

  async delete(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(applications)
      .where(eq(applications.id, id))
      .returning({ id: applications.id });
    return result.length > 0;
  },
};

export const jobRepository = {
  async create(input: CreateJobInput): Promise<Job> {
    const db = getDb();
    const [result] = await db.insert(jobs).values(input).returning();
    return result;
  },

  async findById(id: string): Promise<Job | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, id))
      .limit(1);
    return result;
  },

  async findBySlug(
    slug: string,
    includeInactive = false,
  ): Promise<Job | undefined> {
    const db = getDb();
    const conditions = [eq(jobs.slug, slug)];
    if (!includeInactive) conditions.push(eq(jobs.isActive, true));
    const [result] = await db
      .select()
      .from(jobs)
      .where(and(...conditions))
      .limit(1);
    return result;
  },

  async findAll(includeInactive = false): Promise<Job[]> {
    const db = getDb();
    if (includeInactive) {
      return db.select().from(jobs).orderBy(desc(jobs.postedDate));
    }
    return db
      .select()
      .from(jobs)
      .where(eq(jobs.isActive, true))
      .orderBy(desc(jobs.postedDate));
  },

  async update(
    id: string,
    input: Partial<CreateJobInput>,
  ): Promise<Job | undefined> {
    const db = getDb();
    const [result] = await db
      .update(jobs)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return result;
  },

  async delete(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(jobs)
      .where(eq(jobs.id, id))
      .returning({ id: jobs.id });
    return result.length > 0;
  },
};

export const authRepository = {
  async createMagicToken(
    input: CreateMagicTokenInput,
  ): Promise<typeof magicTokens.$inferSelect> {
    const db = getDb();
    const [result] = await db.insert(magicTokens).values(input).returning();
    return result;
  },

  async findMagicToken(
    token: string,
  ): Promise<typeof magicTokens.$inferSelect | undefined> {
    const db = getDb();
    const now = new Date();
    const [result] = await db
      .select()
      .from(magicTokens)
      .where(and(eq(magicTokens.token, token), gt(magicTokens.expiresAt, now)))
      .limit(1);
    return result;
  },

  async consumeMagicToken(
    token: string,
  ): Promise<typeof magicTokens.$inferSelect | undefined> {
    const db = getDb();
    const now = new Date();
    // Atomic single-use claim: only an unconsumed, unexpired token converts.
    // Parallel replays of the same link lose this race safely.
    const [result] = await db
      .update(magicTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(magicTokens.token, token),
          gt(magicTokens.expiresAt, now),
          isNull(magicTokens.consumedAt),
        ),
      )
      .returning();
    return result;
  },

  async cleanupExpiredTokens(): Promise<void> {
    const db = getDb();
    const now = new Date();
    await db.delete(magicTokens).where(lt(magicTokens.expiresAt, now));
  },

  async createCandidateSession(
    input: CreateCandidateSessionInput,
  ): Promise<typeof candidateSessions.$inferSelect> {
    const db = getDb();
    const [result] = await db
      .insert(candidateSessions)
      .values(input)
      .returning();
    return result;
  },

  async findCandidateSessionByTokenHash(
    tokenHash: string,
  ): Promise<typeof candidateSessions.$inferSelect | undefined> {
    const db = getDb();
    const now = new Date();
    const [result] = await db
      .select()
      .from(candidateSessions)
      .where(
        and(
          eq(candidateSessions.tokenHash, tokenHash),
          gt(candidateSessions.expiresAt, now),
          eq(candidateSessions.revoked, false),
        ),
      )
      .limit(1);
    return result;
  },

  async updateSessionLastUsed(id: string): Promise<void> {
    const db = getDb();
    await db
      .update(candidateSessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(candidateSessions.id, id));
  },

  async revokeSession(tokenHash: string): Promise<void> {
    const db = getDb();
    await db
      .update(candidateSessions)
      .set({ revoked: true })
      .where(eq(candidateSessions.tokenHash, tokenHash));
  },

  async revokeAllSessionsForEmail(email: string): Promise<void> {
    const db = getDb();
    await db
      .update(candidateSessions)
      .set({ revoked: true })
      .where(eq(candidateSessions.email, email));
  },

  async cleanupExpiredSessions(): Promise<void> {
    const db = getDb();
    const now = new Date();
    await db
      .delete(candidateSessions)
      .where(lt(candidateSessions.expiresAt, now));
  },
};

function generateReferralCode(): string {
  const parts: string[] = [];
  for (let i = 0; i < 2; i++) {
    let segment = "";
    for (let j = 0; j < 4; j++) {
      segment += randomCharsetChar();
    }
    parts.push(segment);
  }
  return `SJ-${parts.join("-")}`;
}

export const referralRepository = {
  async create(input: CreateReferralInput): Promise<Referral> {
    const db = getDb();
    let referralCode: string;
    let attempts = 0;
    do {
      referralCode = generateReferralCode();
      const exists = await db
        .select({ id: referrals.id })
        .from(referrals)
        .where(eq(referrals.referralCode, referralCode))
        .limit(1);
      if (exists.length === 0) break;
      attempts++;
    } while (attempts < 5);

    const [result] = await db
      .insert(referrals)
      .values({ ...input, referralCode })
      .returning();
    return result;
  },

  async createMany(inputs: CreateReferralInput[]): Promise<Referral[]> {
    const results: Referral[] = [];
    for (const input of inputs) {
      results.push(await this.create(input));
    }
    return results;
  },

  async findByCode(code: string): Promise<Referral | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referralCode, code))
      .limit(1);
    return result;
  },

  async findById(id: string): Promise<Referral | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.id, id))
      .limit(1);
    return result;
  },

  async findByEmail(email: string): Promise<Referral | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.email, email.toLowerCase().trim()))
      .limit(1);
    return result;
  },

  // Dedup helper for contacts without an email address: a same-named referral
  // with no email is treated as the same person, so repeated conversions of an
  // inbox-less contact do not multiply rows.
  async findByNameWithoutEmail(
    fullName: string,
  ): Promise<Referral | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(referrals)
      .where(
        and(eq(referrals.fullName, fullName), sql`${referrals.email} IS NULL`),
      )
      .limit(1);
    return result;
  },

  async list(
    opts: {
      status?: string;
      search?: string;
      from?: number;
      limit?: number;
    } = {},
  ): Promise<Referral[]> {
    const db = getDb();
    const conditions = [];
    if (opts.status) conditions.push(eq(referrals.status, opts.status));
    if (opts.search) {
      const term = `%${opts.search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(referrals.fullName, term),
          ilike(referrals.email, term),
          ilike(referrals.referredBy, term),
          ilike(referrals.jobTitle, term),
        ),
      );
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;
    return db
      .select()
      .from(referrals)
      .where(whereClause)
      .orderBy(desc(referrals.createdAt))
      .limit(opts.limit ?? 5000);
  },

  async countAll(
    opts: { status?: string; search?: string } = {},
  ): Promise<number> {
    const db = getDb();
    const conditions = [];
    if (opts.status) conditions.push(eq(referrals.status, opts.status));
    if (opts.search) {
      const term = `%${opts.search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(referrals.fullName, term),
          ilike(referrals.email, term),
          ilike(referrals.referredBy, term),
          ilike(referrals.jobTitle, term),
        ),
      );
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const rows = await db
      .select({ n: drizzleCount() })
      .from(referrals)
      .where(whereClause);
    return rows[0]?.n ?? 0;
  },

  async listWithFootprint(
    footprint: string,
    opts: { status?: string; search?: string } = {},
  ): Promise<Referral[]> {
    const db = getDb();
    const conditions = [];
    if (opts.status) conditions.push(eq(referrals.status, opts.status));
    if (opts.search) {
      const term = `%${opts.search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(referrals.fullName, term),
          ilike(referrals.email, term),
          ilike(referrals.referredBy, term),
          ilike(referrals.jobTitle, term),
        ),
      );
    }
    const visited = exists(
      db
        .select({ one: sql`1` })
        .from(footprints)
        .where(
          and(
            eq(footprints.subjectType, "referral"),
            eq(footprints.subjectId, referrals.id),
            eq(footprints.event, "visit"),
          ),
        ),
    );
    const clicked = gt(referrals.clickCount, 0);
    const blocked = exists(
      db
        .select({ one: sql`1` })
        .from(footprints)
        .where(
          and(
            eq(footprints.subjectType, "referral"),
            eq(footprints.subjectId, referrals.id),
            eq(footprints.event, "blocked"),
          ),
        ),
    );
    switch (footprint) {
      case "visited":
        conditions.push(visited);
        break;
      case "not_visited":
        conditions.push(sql`NOT (${visited})`);
        break;
      case "clicked":
        conditions.push(clicked);
        break;
      case "not_clicked":
        conditions.push(sql`NOT (${clicked})`);
        break;
      case "hesitant":
        conditions.push(and(visited, sql`NOT (${clicked})`));
        break;
      case "blocked":
        conditions.push(blocked);
        break;
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;
    return db
      .select()
      .from(referrals)
      .where(whereClause)
      .orderBy(desc(referrals.createdAt))
      .limit(5000);
  },

  async countSentToday(): Promise<number> {
    const db = getDb();
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const rows = await db
      .select({ n: drizzleCount() })
      .from(referrals)
      .where(
        and(eq(referrals.status, "Sent"), gte(referrals.emailSentAt, start)),
      );
    return rows[0]?.n ?? 0;
  },

  async update(
    id: string,
    input: Partial<CreateReferralInput>,
  ): Promise<Referral | undefined> {
    const db = getDb();
    const [result] = await db
      .update(referrals)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(referrals.id, id))
      .returning();
    return result;
  },

  async enrich(
    id: string,
    detail: Record<string, string | null | undefined>,
  ): Promise<Referral | undefined> {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.id, id))
      .limit(1);
    if (!existing) return undefined;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(detail)) {
      if (v) {
        const cur = (existing as Record<string, unknown>)[k];
        if (cur === null || cur === undefined || cur === "") patch[k] = v;
      }
    }
    if (Object.keys(patch).length === 1) return existing;
    const [result] = await db
      .update(referrals)
      .set(patch)
      .where(eq(referrals.id, id))
      .returning();
    return result;
  },

  async markSent(id: string, sentAt: Date): Promise<boolean> {
    const db = getDb();
    const [result] = await db
      .update(referrals)
      .set({ status: "Sent", emailSentAt: sentAt, updatedAt: new Date() })
      .where(and(eq(referrals.id, id), ne(referrals.status, "Sent")))
      .returning({ id: referrals.id });
    return !!result;
  },

  async recordClick(
    referralId: string,
    deviceType: string,
    at: Date,
  ): Promise<void> {
    const db = getDb();
    await db.insert(referralClicks).values({
      referralId,
      deviceType,
      clickedAt: at,
    });
    await db
      .update(referrals)
      .set({
        clickCount: sql`${referrals.clickCount} + 1`,
        lastClickedAt: at,
        lastDevice: deviceType,
        updatedAt: new Date(),
      })
      .where(eq(referrals.id, referralId));
  },

  async delete(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(referrals)
      .where(eq(referrals.id, id))
      .returning({ id: referrals.id });
    return result.length > 0;
  },

  async deleteMany(ids: string[]): Promise<number> {
    const db = getDb();
    if (ids.length === 0) return 0;
    const result = await db
      .delete(referrals)
      .where(inArray(referrals.id, ids))
      .returning({ id: referrals.id });
    return result.length;
  },

  async clearAll(): Promise<number> {
    const db = getDb();
    const result = await db.delete(referrals).returning({ id: referrals.id });
    return result.length;
  },

  async getContent(): Promise<Record<string, string>> {
    const db = getDb();
    const rows = await db.select().from(referralContent);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.body;
    return map;
  },

  async setContent(entries: Record<string, string>): Promise<void> {
    const db = getDb();
    for (const [key, body] of Object.entries(entries)) {
      await db
        .insert(referralContent)
        .values({ key, body })
        .onConflictDoUpdate({
          target: referralContent.key,
          set: { body, updatedAt: new Date() },
        });
    }
  },

  async seedContentIfAbsent(entries: Record<string, string>): Promise<void> {
    const db = getDb();
    const values = Object.entries(entries).map(([key, body]) => ({
      key,
      body,
    }));
    if (values.length === 0) return;
    await db.insert(referralContent).values(values).onConflictDoNothing();
  },

  async upgradeContentAll(
    map: Record<string, { old: string; next: string }>,
  ): Promise<void> {
    const db = getDb();
    for (const [key, { old, next }] of Object.entries(map)) {
      await db
        .update(referralContent)
        .set({ body: next, updatedAt: new Date() })
        .where(
          and(eq(referralContent.key, key), eq(referralContent.body, old)),
        );
    }
  },

  async getContentOverrides(id: string): Promise<Record<string, string>> {
    const db = getDb();
    const [row] = await db
      .select({ contentOverrides: referrals.contentOverrides })
      .from(referrals)
      .where(eq(referrals.id, id))
      .limit(1);
    return row?.contentOverrides ?? {};
  },

  async setContentOverrides(
    ids: string[],
    entries: Record<string, string>,
  ): Promise<void> {
    const db = getDb();
    if (ids.length === 0) return;
    await db
      .update(referrals)
      .set({
        contentOverrides: sql`coalesce(${referrals.contentOverrides}, '{}'::jsonb) || ${JSON.stringify(
          entries,
        )}::jsonb`,
        updatedAt: new Date(),
      })
      .where(inArray(referrals.id, ids));
  },

  async setContentOverridesAll(entries: Record<string, string>): Promise<void> {
    const db = getDb();
    // Single UPDATE that layers the overrides onto existing rows via JSONB
    // merge, avoiding one DB round-trip per row.
    await db.update(referrals).set({
      contentOverrides: sql`coalesce(${referrals.contentOverrides}, '{}'::jsonb) || ${JSON.stringify(
        entries,
      )}::jsonb`,
      updatedAt: new Date(),
    });
  },

  async clearContentOverrides(ids: string[], keys?: string[]): Promise<void> {
    const db = getDb();
    if (ids.length === 0) return;
    if (!keys) {
      await db
        .update(referrals)
        .set({ contentOverrides: sql`'{}'::jsonb`, updatedAt: new Date() })
        .where(inArray(referrals.id, ids));
      return;
    }
    // Remove only the specified keys using JSONB deletion for each key.
    const jsonKeys = keys.map((k) => `'${k.replace(/'/g, "''")}'`).join(", ");
    await db
      .update(referrals)
      .set({
        contentOverrides: sql`${referrals.contentOverrides} - ARRAY[${sql.raw(
          jsonKeys,
        )}]::text[]`,
        updatedAt: new Date(),
      })
      .where(inArray(referrals.id, ids));
  },

  async getSettings(): Promise<ReferralSettingsRow> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(referralSettings)
      .where(eq(referralSettings.id, 1))
      .limit(1);
    if (row) return row;
    await db
      .insert(referralSettings)
      .values({ id: 1, dailySendLimit: 5 })
      .onConflictDoNothing();
    return { id: 1, dailySendLimit: 5, updatedAt: new Date() };
  },

  async setDailySendLimit(limit: number): Promise<void> {
    const db = getDb();
    await db
      .insert(referralSettings)
      .values({ id: 1, dailySendLimit: limit })
      .onConflictDoUpdate({
        target: referralSettings.id,
        set: { dailySendLimit: limit, updatedAt: new Date() },
      });
  },
};

function contactFootprintCondition(footprint?: string): SQL | undefined {
  if (!footprint) return undefined;
  const db = getDb();
  const visited = exists(
    db
      .select({ one: sql`1` })
      .from(referrals)
      .where(
        and(
          eq(referrals.email, contacts.email),
          exists(
            db
              .select({ one: sql`1` })
              .from(footprints)
              .where(
                and(
                  eq(footprints.subjectType, "referral"),
                  eq(footprints.subjectId, referrals.id),
                  eq(footprints.event, "visit"),
                ),
              ),
          ),
        ),
      ),
  );
  const clicked = exists(
    db
      .select({ one: sql`1` })
      .from(referrals)
      .where(
        and(eq(referrals.email, contacts.email), gt(referrals.clickCount, 0)),
      ),
  );
  const blocked = exists(
    db
      .select({ one: sql`1` })
      .from(referrals)
      .where(
        and(
          eq(referrals.email, contacts.email),
          exists(
            db
              .select({ one: sql`1` })
              .from(footprints)
              .where(
                and(
                  eq(footprints.subjectType, "referral"),
                  eq(footprints.subjectId, referrals.id),
                  eq(footprints.event, "blocked"),
                ),
              ),
          ),
        ),
      ),
  );
  switch (footprint) {
    case "visited":
      return visited;
    case "not_visited":
      return sql`NOT (${visited})`;
    case "clicked":
      return clicked;
    case "not_clicked":
      return sql`NOT (${clicked})`;
    case "hesitant":
      return and(visited, sql`NOT (${clicked})`);
    case "blocked":
      return blocked;
    default:
      return undefined;
  }
}

export const contactRepository = {
  async createMany(inputs: CreateContactInput[]): Promise<number> {
    const db = getDb();
    if (inputs.length === 0) return 0;
    const results = await db.insert(contacts).values(inputs).returning();
    return results.length;
  },

  async list(
    opts: {
      search?: string;
      from?: number;
      limit?: number;
      footprint?: string;
    } = {},
  ): Promise<Contact[]> {
    const db = getDb();
    const conditions = [];
    if (opts.search) {
      const term = `%${opts.search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(contacts.fullName, term),
          ilike(contacts.firstName, term),
          ilike(contacts.lastName, term),
          ilike(contacts.email, term),
          ilike(contacts.phone, term),
          ilike(contacts.address, term),
          ilike(contacts.postalCode, term),
        ),
      );
    }
    const footprintCond = contactFootprintCondition(opts.footprint);
    if (footprintCond) conditions.push(footprintCond);
    const whereClause = conditions.length ? and(...conditions) : undefined;
    return db
      .select()
      .from(contacts)
      .where(whereClause)
      .orderBy(desc(contacts.createdAt))
      .limit(opts.limit ?? 100)
      .offset(opts.from ?? 0);
  },

  async countAll(
    opts: { search?: string; footprint?: string } = {},
  ): Promise<number> {
    const db = getDb();
    const conditions = [];
    if (opts.search) {
      const term = `%${opts.search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(contacts.fullName, term),
          ilike(contacts.firstName, term),
          ilike(contacts.lastName, term),
          ilike(contacts.email, term),
          ilike(contacts.phone, term),
          ilike(contacts.address, term),
          ilike(contacts.postalCode, term),
        ),
      );
    }
    const footprintCond = contactFootprintCondition(opts.footprint);
    if (footprintCond) conditions.push(footprintCond);
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const rows = await db
      .select({ n: drizzleCount() })
      .from(contacts)
      .where(whereClause);
    return rows[0]?.n ?? 0;
  },

  async findByEmail(email: string): Promise<Contact | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.email, email.toLowerCase().trim()))
      .limit(1);
    return result;
  },

  async listAll(): Promise<Contact[]> {
    const db = getDb();
    return db.select().from(contacts).orderBy(desc(contacts.createdAt));
  },

  async listByIds(ids: string[]): Promise<Contact[]> {
    const db = getDb();
    if (ids.length === 0) return [];
    return db
      .select()
      .from(contacts)
      .where(inArray(contacts.id, ids))
      .orderBy(desc(contacts.createdAt));
  },

  async importMany(
    rows: Array<{
      fullName?: string;
      email?: string;
      phone?: string;
      address?: string;
      zipCode?: string;
    }>,
  ): Promise<{ created: Contact[]; updated: Contact[]; skipped: string[] }> {
    const db = getDb();
    const created: Contact[] = [];
    const updated: Contact[] = [];
    const skipped: string[] = [];
    for (const row of rows) {
      const fullName = (row.fullName ?? "").trim();
      if (!fullName) {
        skipped.push("unnamed row");
        continue;
      }
      const email = (row.email ?? "").trim().toLowerCase() || null;
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] ?? null;
      const lastName =
        nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
      const phone = (row.phone ?? "").trim() || null;
      const address = (row.address ?? "").trim() || null;
      const postalCode = (row.zipCode ?? "").trim() || null;
      try {
        if (email) {
          const existing = await this.findByEmail(email);
          if (existing) {
            const patch: Partial<CreateContactInput> = {
              updatedAt: new Date(),
            };
            if (!existing.firstName && firstName) patch.firstName = firstName;
            if (!existing.lastName && lastName) patch.lastName = lastName;
            if (!existing.fullName && fullName) patch.fullName = fullName;
            if (!existing.phone && phone) patch.phone = phone;
            if (!existing.address && address) patch.address = address;
            if (!existing.postalCode && postalCode) {
              patch.postalCode = postalCode;
            }
            if (Object.keys(patch).length > 1) {
              const [result] = await db
                .update(contacts)
                .set(patch)
                .where(eq(contacts.id, existing.id))
                .returning();
              if (result) updated.push(result);
            } else {
              updated.push(existing);
            }
            continue;
          }
        }
        const [result] = await db
          .insert(contacts)
          .values({
            firstName,
            lastName,
            fullName,
            email,
            phone,
            address,
            postalCode,
          })
          .returning();
        created.push(result);
      } catch (err) {
        skipped.push(`${fullName} - ${(err as Error).message}`);
      }
    }
    return { created, updated, skipped };
  },

  async deleteMany(ids: string[]): Promise<number> {
    const db = getDb();
    if (ids.length === 0) return 0;
    const result = await db
      .delete(contacts)
      .where(inArray(contacts.id, ids))
      .returning({ id: contacts.id });
    return result.length;
  },

  async clearAll(): Promise<number> {
    const db = getDb();
    const result = await db.delete(contacts).returning({ id: contacts.id });
    return result.length;
  },

  async delete(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning({ id: contacts.id });
    return result.length > 0;
  },
};

export type FootprintSummary = {
  visits: number;
  clicks: number;
  downloads: number;
  blocked: number;
  firstVisitAt: Date | null;
  lastVisitAt: Date | null;
  lastVisitDevice: string | null;
  lastClickAt: Date | null;
  lastClickDevice: string | null;
  hesitant: boolean;
};

function emptyFootprintSummary(): FootprintSummary {
  return {
    visits: 0,
    clicks: 0,
    downloads: 0,
    blocked: 0,
    firstVisitAt: null,
    lastVisitAt: null,
    lastVisitDevice: null,
    lastClickAt: null,
    lastClickDevice: null,
    hesitant: false,
  };
}

export const footprintRepository = {
  async record(input: {
    subjectType: "referral" | "candidate";
    subjectId: string;
    event:
      | "visit"
      | "click"
      | "proceed"
      | "download"
      | "blocked"
      | "background"
      | "roomRevealed";
    device: string;
    userAgent?: string;
    meta?: Record<string, unknown> | null;
  }): Promise<void> {
    const db = getDb();
    await db.insert(footprints).values({
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      event: input.event,
      device: input.device,
      userAgent: input.userAgent ?? null,
      meta: input.meta ?? null,
    });
  },

  async listBySubject(
    subjectType: "referral" | "candidate",
    subjectId: string,
    limit = 50,
  ): Promise<Footprint[]> {
    const db = getDb();
    return db
      .select()
      .from(footprints)
      .where(
        and(
          eq(footprints.subjectType, subjectType),
          eq(footprints.subjectId, subjectId),
        ),
      )
      .orderBy(desc(footprints.createdAt))
      .limit(limit);
  },

  async summaryForReferrals(
    referralIds: string[],
  ): Promise<Map<string, FootprintSummary>> {
    const db = getDb();
    const map = new Map<string, FootprintSummary>();
    if (referralIds.length === 0) return map;
    for (const id of referralIds) {
      map.set(id, emptyFootprintSummary());
    }
    const rows = await db
      .select({
        subjectId: footprints.subjectId,
        event: footprints.event,
        device: footprints.device,
        createdAt: footprints.createdAt,
      })
      .from(footprints)
      .where(
        and(
          eq(footprints.subjectType, "referral"),
          inArray(footprints.subjectId, referralIds),
        ),
      )
      .orderBy(asc(footprints.createdAt));
    for (const row of rows) {
      const s = map.get(row.subjectId);
      if (!s) continue;
      if (row.event === "visit") {
        s.visits++;
        if (!s.firstVisitAt || row.createdAt < s.firstVisitAt) {
          s.firstVisitAt = row.createdAt;
        }
        if (!s.lastVisitAt || row.createdAt >= s.lastVisitAt) {
          s.lastVisitAt = row.createdAt;
          s.lastVisitDevice = row.device;
        }
      } else if (row.event === "click") {
        s.clicks++;
        if (!s.lastClickAt || row.createdAt >= s.lastClickAt) {
          s.lastClickAt = row.createdAt;
          s.lastClickDevice = row.device;
        }
      } else if (row.event === "download") {
        s.downloads++;
      } else if (row.event === "blocked") {
        s.blocked++;
      }
    }
    for (const s of map.values()) {
      s.hesitant = s.visits > 0 && s.clicks === 0;
    }
    return map;
  },

  async summaryForApplications(
    applicationIds: string[],
  ): Promise<Map<string, FootprintSummary>> {
    const db = getDb();
    const map = new Map<string, FootprintSummary>();
    if (applicationIds.length === 0) return map;
    for (const id of applicationIds) {
      map.set(id, emptyFootprintSummary());
    }
    const rows = await db
      .select({
        subjectId: footprints.subjectId,
        event: footprints.event,
        device: footprints.device,
        createdAt: footprints.createdAt,
      })
      .from(footprints)
      .where(
        and(
          eq(footprints.subjectType, "candidate"),
          inArray(footprints.subjectId, applicationIds),
        ),
      )
      .orderBy(asc(footprints.createdAt));
    for (const row of rows) {
      const s = map.get(row.subjectId);
      if (!s) continue;
      if (row.event === "visit") {
        s.visits++;
        if (!s.firstVisitAt || row.createdAt < s.firstVisitAt) {
          s.firstVisitAt = row.createdAt;
        }
        if (!s.lastVisitAt || row.createdAt >= s.lastVisitAt) {
          s.lastVisitAt = row.createdAt;
          s.lastVisitDevice = row.device;
        }
      } else if (row.event === "proceed") {
        s.clicks++;
        if (!s.lastClickAt || row.createdAt >= s.lastClickAt) {
          s.lastClickAt = row.createdAt;
          s.lastClickDevice = row.device;
        }
      } else if (row.event === "download") {
        s.downloads++;
      } else if (row.event === "blocked") {
        s.blocked++;
      }
    }
    for (const s of map.values()) {
      s.hesitant = s.visits > 0 && s.clicks === 0;
    }
    return map;
  },

  async findByEmailsForReferrals(
    emails: string[],
  ): Promise<Map<string, { id: string }>> {
    const db = getDb();
    const map = new Map<string, { id: string }>();
    if (emails.length === 0) return map;
    const rows = await db
      .select({ email: referrals.email, id: referrals.id })
      .from(referrals)
      .where(
        and(
          isNotNull(referrals.email),
          inArray(
            referrals.email,
            emails.map((e) => e.toLowerCase()),
          ),
        ),
      );
    for (const row of rows) {
      if (row.email) map.set(row.email.toLowerCase(), { id: row.id });
    }
    return map;
  },
};

export const activityRepository = {
  async record(input: CreateActivityInput): Promise<Activity | undefined> {
    const db = getDb();
    const [result] = await db
      .insert(activities)
      .values({
        actor: input.actor,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        targetEmail: input.targetEmail ?? null,
        detail: input.detail ?? null,
        status: input.status ?? "ok",
        error: input.error ?? null,
      })
      .returning();
    return result;
  },

  async list(
    opts: {
      limit?: number;
      action?: string;
      email?: string;
    } = {},
  ): Promise<Activity[]> {
    const db = getDb();
    const conditions = [];
    if (opts.action) conditions.push(eq(activities.action, opts.action));
    if (opts.email) conditions.push(eq(activities.targetEmail, opts.email));
    const whereClause = conditions.length ? and(...conditions) : undefined;
    return db
      .select()
      .from(activities)
      .where(whereClause)
      .orderBy(desc(activities.createdAt))
      .limit(opts.limit ?? 100);
  },

  async count(opts: { action?: string } = {}): Promise<number> {
    const db = getDb();
    const conditions = [];
    if (opts.action) conditions.push(eq(activities.action, opts.action));
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const rows = await db
      .select({ n: drizzleCount() })
      .from(activities)
      .where(whereClause);
    return rows[0]?.n ?? 0;
  },
};

export type CampaignWithStats = Campaign & {
  visits: number;
  ctaClicks: number;
  applications: number;
  lastVisitAt: Date | null;
};

export const campaignRepository = {
  async listWithStats(): Promise<CampaignWithStats[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(campaigns)
      .orderBy(desc(campaigns.createdAt));

    const visitRows = await db
      .select({
        campaignId: campaignVisits.campaignId,
        visits: sql<number>`count(*)::int`,
        ctaClicks: sql<number>`COALESCE(sum(clicked_cta::int), 0)::int`,
        lastVisitAt: sql<Date | null>`max(visited_at)`,
      })
      .from(campaignVisits)
      .groupBy(campaignVisits.campaignId);

    const appRows = await db
      .select({
        campaignSlug: applications.campaignSlug,
        n: sql<number>`count(*)::int`,
      })
      .from(applications)
      .where(isNotNull(applications.campaignSlug))
      .groupBy(applications.campaignSlug);

    const visitsByCampaign = new Map(visitRows.map((r) => [r.campaignId, r]));
    const appsBySlug = new Map(appRows.map((r) => [r.campaignSlug, r.n]));

    return rows.map((campaign) => {
      const v = visitsByCampaign.get(campaign.id);
      return {
        ...campaign,
        visits: v?.visits ?? 0,
        ctaClicks: v?.ctaClicks ?? 0,
        applications: appsBySlug.get(campaign.slug) ?? 0,
        lastVisitAt: v?.lastVisitAt ?? null,
      };
    });
  },

  async findPublicBySlug(slug: string): Promise<Campaign | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.slug, slug), eq(campaigns.isEnabled, true)))
      .limit(1);
    return result;
  },

  async findBySlug(slug: string): Promise<Campaign | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.slug, slug))
      .limit(1);
    return result;
  },

  async create(input: CreateCampaignInput): Promise<Campaign> {
    const db = getDb();
    const [result] = await db.insert(campaigns).values(input).returning();
    return result;
  },

  async update(
    id: string,
    patch: Partial<CreateCampaignInput>,
  ): Promise<Campaign | undefined> {
    const db = getDb();
    const [result] = await db
      .update(campaigns)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return result;
  },

  async remove(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(campaigns)
      .where(eq(campaigns.id, id))
      .returning({ id: campaigns.id });
    return result.length > 0;
  },

  async recordVisit(input: {
    campaignId: string;
    device: string;
    clickedCta: boolean;
    userAgent?: string;
  }): Promise<void> {
    const db = getDb();
    await db.insert(campaignVisits).values({
      campaignId: input.campaignId,
      device: input.device,
      clickedCta: input.clickedCta,
      userAgent: input.userAgent ?? null,
    });
  },

  async publicStats(): Promise<{
    openJobs: number;
    applicationsProcessed: number;
    countriesReached: number;
  }> {
    const db = getDb();
    const [jobsRow] = await db
      .select({ n: drizzleCount() })
      .from(jobs)
      .where(eq(jobs.isActive, true));
    const [appsRow] = await db.select({ n: drizzleCount() }).from(applications);
    const [refsRow] = await db
      .select({
        n: drizzleCount(),
      })
      .from(referrals)
      .where(isNotNull(referrals.country));

    const countryRows = await db
      .select({ country: applications.country })
      .from(applications)
      .where(isNotNull(applications.country))
      .groupBy(applications.country);
    const refCountryRows = await db
      .select({ country: referrals.country })
      .from(referrals)
      .where(isNotNull(referrals.country))
      .groupBy(referrals.country);

    const countries = new Set<string>();
    for (const r of countryRows) {
      const country = (r.country ?? "").trim().toLowerCase();
      if (country) countries.add(country);
    }
    for (const r of refCountryRows) {
      const country = (r.country ?? "").trim().toLowerCase();
      if (country) countries.add(country);
    }

    return {
      openJobs: jobsRow?.n ?? 0,
      applicationsProcessed: (appsRow?.n ?? 0) + (refsRow?.n ?? 0),
      countriesReached: countries.size,
    };
  },
};
