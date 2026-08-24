import { SignJWT, jwtVerify } from "jose";
import { authRepository } from "../repositories";
import { neon } from "@neondatabase/serverless";
import { getEnv } from "../config";

const MAGIC_LINK_TTL = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function getJwtSecret(): Uint8Array {
  const { JWT_SECRET } = getEnv();
  // An empty/short secret makes HS256 session tokens forgeable — refuse.
  if (!JWT_SECRET || JWT_SECRET.length < 16) {
    throw new Error("JWT_SECRET must be set to at least 16 characters");
  }
  return new TextEncoder().encode(JWT_SECRET);
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function getFrontendUrl(): string {
  const url = (getEnv().FRONTEND_URL ?? "").trim();
  if (!url) {
    // A relative href is dead on arrival inside an email client — fall back
    // to the same default domain used everywhere else in the pipeline.
    console.warn(
      "FRONTEND_URL not set - magic links will use the default domain. Set FRONTEND_URL in production.",
    );
    return "https://swiftjob.payservice.top".replace(/\/$/, "");
  }
  return url.replace(/\/$/, "");
}

export const authService = {
  async generateMagicToken(email: string): Promise<string> {
    const token = randomToken();
    const tokenHash = await hashToken(token);
    const normalizedEmail = email.toLowerCase().trim();
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL);

    await authRepository.createMagicToken({
      token: tokenHash,
      email: normalizedEmail,
      expiresAt,
    });

    void authRepository.cleanupExpiredTokens();

    return token;
  },

  async consumeMagicToken(token: string): Promise<string | null> {
    const tokenHash = await hashToken(token);
    // Single atomic claim — the UPDATE only matches unconsumed, unexpired
    // tokens, so replays and parallel clicks cannot mint two sessions.
    const consumed = await authRepository.consumeMagicToken(tokenHash);
    if (!consumed) {
      return null;
    }

    return consumed.email;
  },

  async generateSessionToken(email: string): Promise<string> {
    const sessionToken = randomToken();
    const tokenHash = await hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL);

    await authRepository.createCandidateSession({
      email: email.toLowerCase().trim(),
      tokenHash,
      expiresAt,
    });

    void authRepository.cleanupExpiredSessions();

    return new SignJWT({
      sessionToken,
      email: email.toLowerCase().trim(),
      role: "candidate",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(getJwtSecret());
  },

  async verifySessionToken(token: string): Promise<{
    id: string;
    email: string;
    role: string;
    sessionToken?: string;
  } | null> {
    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      const email = payload.email as string;
      return {
        id: email,
        email,
        role: (payload.role as string) || "candidate",
        sessionToken: payload.sessionToken as string | undefined,
      };
    } catch {
      return null;
    }
  },

  async validateSessionToken(
    token: string,
  ): Promise<{ email: string; valid: boolean } | null> {
    const decoded = await this.verifySessionToken(token);
    if (!decoded || !decoded.sessionToken) {
      return null;
    }

    const tokenHash = await hashToken(decoded.sessionToken);
    const session =
      await authRepository.findCandidateSessionByTokenHash(tokenHash);

    if (!session) {
      return { email: decoded.email, valid: false };
    }

    await authRepository.updateSessionLastUsed(session.id);

    return { email: session.email, valid: true };
  },

  async revokeSession(token: string): Promise<void> {
    const decoded = await this.verifySessionToken(token);
    if (!decoded || !decoded.sessionToken) {
      return;
    }
    const tokenHash = await hashToken(decoded.sessionToken);
    await authRepository.revokeSession(tokenHash);
  },

  async revokeAllSessions(email: string): Promise<void> {
    await authRepository.revokeAllSessionsForEmail(email.toLowerCase().trim());
  },

  buildMagicLinkUrl(token: string): string {
    const base = getFrontendUrl();
    if (!base) {
      console.error("FRONTEND_URL not configured - magic link will be broken!");
    }
    return `${base}/login/confirm?token=${token}`;
  },

  // ============================================
  // Password accounts (optional, alongside magic links)
  // ============================================
  async hashPassword(
    password: string,
  ): Promise<{ hash: string; salt: string }> {
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const salt = Array.from(saltBytes, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: 150_000,
        hash: "SHA-256",
      },
      key,
      256,
    );
    const hash = Array.from(new Uint8Array(bits), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    return { hash, salt };
  },

  async verifyPassword(password: string, stored: string): Promise<boolean> {
    // stored format: pbkdf2$<iterations>$<saltHex>$<hashHex>
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const expected = parts[3];
    const saltBytes = new Uint8Array(
      saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)),
    );
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations,
        hash: "SHA-256",
      },
      key,
      256,
    );
    const actual = Array.from(new Uint8Array(bits), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    // Constant-time-ish compare.
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
      diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
  },

  async setPasswordAccount(email: string, password: string): Promise<void> {
    const { DATABASE_URL } = getEnv();
    if (!DATABASE_URL) throw new Error("DATABASE_URL must be set");
    const normalized = email.toLowerCase().trim();
    const { hash, salt } = await this.hashPassword(password);
    const stored = `pbkdf2$150000$${salt}$${hash}`;
    const sql = neon(DATABASE_URL);
    await sql(
      `INSERT INTO candidate_accounts (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, updated_at = now()`,
      [normalized, stored],
    );
  },

  async hasPasswordAccount(email: string): Promise<boolean> {
    const { DATABASE_URL } = getEnv();
    if (!DATABASE_URL) return false;
    const sql = neon(DATABASE_URL);
    const rows = await sql(
      `SELECT 1 FROM candidate_accounts WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()],
    );
    return Boolean(rows && rows.length > 0);
  },

  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<string | null> {
    const { DATABASE_URL } = getEnv();
    if (!DATABASE_URL) throw new Error("DATABASE_URL must be set");
    const sql = neon(DATABASE_URL);
    const rows = await sql(
      `SELECT password_hash FROM candidate_accounts WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()],
    );
    if (!rows || rows.length === 0) return null;
    const ok = await this.verifyPassword(
      password,
      String(rows[0].password_hash),
    );
    if (!ok) return null;
    // Same session shape the magic-link verify issues.
    return this.generateSessionToken(email);
  },
};
