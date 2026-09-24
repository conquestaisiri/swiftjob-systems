import { emailUnsubscriptionRepository } from "../repositories";
import { getEnv } from "../config";
import { getPublicSiteUrl } from "./siteUrl";

const encoder = new TextEncoder();
const TOKEN_VERSION = 1;
const AES_GCM_IV_BYTES = 12;

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(token: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{40,512}$/.test(token)) return null;
  try {
    const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = getEnv().JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be configured to protect unsubscribe links");
  }
  const material = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`swiftjob-email-unsubscribe-v1:${secret}`),
  );
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Authenticated, encrypted, address-free token; GET visits never opt a person out. */
export async function createEmailUnsubscribeToken(email: string): Promise<string> {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("A valid email address is required");

  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await getEncryptionKey(),
      encoder.encode(normalized),
    ),
  );
  const payload = new Uint8Array(1 + iv.length + encrypted.length);
  payload[0] = TOKEN_VERSION;
  payload.set(iv, 1);
  payload.set(encrypted, 1 + iv.length);
  return encodeBase64Url(payload);
}

export async function verifyEmailUnsubscribeToken(
  token: string,
): Promise<string | null> {
  const payload = decodeBase64Url(token);
  if (!payload || payload.length <= 1 + AES_GCM_IV_BYTES || payload[0] !== TOKEN_VERSION) {
    return null;
  }

  try {
    const iv = payload.slice(1, 1 + AES_GCM_IV_BYTES);
    const ciphertext = payload.slice(1 + AES_GCM_IV_BYTES);
    const cleartext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await getEncryptionKey(),
      ciphertext,
    );
    const email = normalizeEmail(new TextDecoder().decode(cleartext));
    return email;
  } catch {
    return null;
  }
}

export const emailUnsubscribeService = {
  async createLink(email: string): Promise<string> {
    const token = await createEmailUnsubscribeToken(email);
    const url = new URL("/api/email/unsubscribe", getPublicSiteUrl());
    url.searchParams.set("token", token);
    return url.toString();
  },

  verifyToken: verifyEmailUnsubscribeToken,

  async isUnsubscribed(email: string): Promise<boolean> {
    return emailUnsubscriptionRepository.isUnsubscribed(email);
  },

  async unsubscribe(
    email: string,
    source: "outreach_link" | "one_click",
  ): Promise<void> {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error("Invalid email address in unsubscribe link");
    await emailUnsubscriptionRepository.unsubscribe(normalized, source);
  },
};
