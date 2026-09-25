import { count, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../db";
import { emailDeliveryEvents, emailProviderSuppressions } from "../schema";
import { verifySchemaOnce } from "./schema";

const MAX_EVENT_AGE_SECONDS = 5 * 60;
const EVENT_RETENTION_DAYS = 90;

const eventTypes = [
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.delivery_delayed",
  "email.failed",
  "email.suppressed",
] as const;

const eventPayloadSchema = z.object({
  type: z.string().trim().min(1).max(100),
  created_at: z.string().trim().min(1).max(64).optional(),
  data: z.object({
    email_id: z.string().trim().min(1).max(255).optional(),
    created_at: z.string().trim().min(1).max(64).optional(),
    to: z.union([
      z.string().max(320),
      z.array(z.string().max(320)).max(50),
    ]).optional(),
    bounce: z.object({ type: z.string().trim().max(64).optional() }).passthrough().optional(),
  }).passthrough(),
}).passthrough();

export type VerifiedResendEvent = {
  type: string;
  eventId: string;
  emailId: string | null;
  occurredAt: Date;
  recipients: string[];
  permanentBounce: boolean;
};

type SvixHeaders = {
  id: string | null | undefined;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
};

function decodeBase64(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function normalizeRecipients(value: string | string[] | undefined): string[] {
  const recipients = typeof value === "string" ? [value] : value ?? [];
  return recipients
    .map((address) => address.trim().toLowerCase())
    .filter((address) => z.string().email().safeParse(address).success);
}

export async function verifyResendWebhook(
  payload: string,
  headers: SvixHeaders,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifiedResendEvent | null> {
  const eventId = headers.id?.trim() ?? "";
  const timestampText = headers.timestamp?.trim() ?? "";
  const signatureHeader = headers.signature?.trim() ?? "";
  if (!eventId || !/^\d{1,12}$/.test(timestampText) || !signatureHeader) return null;

  const timestamp = Number(timestampText);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > MAX_EVENT_AGE_SECONDS
  ) {
    return null;
  }

  const encodedSecret = secret.startsWith("whsec_") ? secret.slice(6) : "";
  if (!encodedSecret) return null;

  try {
    const keyBytes = decodeBase64(encodedSecret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signedContent = new TextEncoder().encode(
      `${eventId}.${timestampText}.${payload}`,
    );
    const signatures = signatureHeader
      .split(/\s+/)
      .map((candidate) => candidate.split(",", 2))
      .filter(([version, value]) => version === "v1" && Boolean(value))
      .map(([, value]) => decodeBase64(value));

    let signatureValid = false;
    for (const signature of signatures) {
      if (await crypto.subtle.verify("HMAC", key, signature, signedContent)) {
        signatureValid = true;
      }
    }
    if (!signatureValid) return null;

    const parsedJson: unknown = JSON.parse(payload);
    const parsed = eventPayloadSchema.safeParse(parsedJson);
    if (!parsed.success) return null;

    const occurredAtText = parsed.data.created_at ?? parsed.data.data.created_at;
    const occurredAt = occurredAtText ? new Date(occurredAtText) : new Date(timestamp * 1000);
    if (!Number.isFinite(occurredAt.getTime())) return null;

    return {
      type: parsed.data.type,
      eventId,
      emailId: parsed.data.data.email_id ?? null,
      occurredAt,
      recipients: normalizeRecipients(parsed.data.data.to),
      permanentBounce:
        parsed.data.type === "email.bounced" &&
        parsed.data.data.bounce?.type?.toLowerCase() === "permanent",
    };
  } catch {
    return null;
  }
}

export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const body = request.body;
  if (!body) throw new Error("Request body is empty");

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Request body exceeds the size limit");
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error("Request body exceeds the size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
}

export const emailDeliveryService = {
  verifyWebhook: verifyResendWebhook,

  async processWebhook(event: VerifiedResendEvent): Promise<{ ignored?: boolean }> {
    if (!eventTypes.some((knownType) => knownType === event.type) || !event.emailId) {
      return { ignored: true };
    }

    const reason = event.type === "email.complained"
      ? "spam_complaint"
      : event.permanentBounce
        ? "permanent_bounce"
        : null;

    if (reason) {
      for (const email of event.recipients) {
        await getDb()
          .insert(emailProviderSuppressions)
          .values({
            email,
            reason,
            sourceEventId: event.eventId,
            suppressedAt: event.occurredAt,
          })
          .onConflictDoUpdate({
            target: emailProviderSuppressions.email,
            set: {
              reason,
              sourceEventId: event.eventId,
              suppressedAt: event.occurredAt,
            },
          });
      }
    }

    await getDb()
      .insert(emailDeliveryEvents)
      .values({
        providerEventId: event.eventId,
        emailId: event.emailId,
        eventType: event.type,
        occurredAt: event.occurredAt,
      })
      .onConflictDoNothing({ target: emailDeliveryEvents.providerEventId });

    return {};
  },

  async isSuppressed(address: string): Promise<boolean> {
    const email = address.trim().toLowerCase();
    const [match] = await getDb()
      .select({ email: emailProviderSuppressions.email })
      .from(emailProviderSuppressions)
      .where(eq(emailProviderSuppressions.email, email))
      .limit(1);
    return Boolean(match);
  },

  async summary(): Promise<{
    generatedAt: string;
    periodDays: number;
    events: Record<string, number>;
    suppressedRecipients: number;
  }> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const db = getDb();
    const [eventCounts, [suppressionCount]] = await Promise.all([
      db
        .select({
          eventType: emailDeliveryEvents.eventType,
          total: sql<number>`count(*)::int`,
        })
        .from(emailDeliveryEvents)
        .where(gte(emailDeliveryEvents.occurredAt, since))
        .groupBy(emailDeliveryEvents.eventType),
      db.select({ total: count() }).from(emailProviderSuppressions),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      periodDays: 30,
      events: Object.fromEntries(eventCounts.map(({ eventType, total }) => [eventType, total])),
      suppressedRecipients: suppressionCount?.total ?? 0,
    };
  },

  async pruneExpiredEvents(): Promise<void> {
    await verifySchemaOnce();
    const cutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await getDb()
      .delete(emailDeliveryEvents)
      .where(lt(emailDeliveryEvents.occurredAt, cutoff));
  },
};
