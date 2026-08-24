import { SignJWT, jwtVerify } from "jose";
import { authRepository } from "../repositories";
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
};
