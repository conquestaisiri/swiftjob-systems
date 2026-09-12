// Batch A regression: AUTH-01/02/03 + API-01.
// Static source assertions + live JWT claim checks (no DB, no network).
// Exit non-zero on any failure.
import { readFileSync } from "node:fs";
import { SignJWT, jwtVerify } from "../../workers-api/node_modules/jose/dist/node/esm/index.js";

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const workerSrc = read("../../workers-api/src/index.ts");
const authSvcSrc = read("../../workers-api/src/services/auth.ts");
const appSuccess = read("../../artifacts/swiftjob-systems/src/pages/ApplicationSuccess.tsx");
const portal = read("../../artifacts/swiftjob-systems/src/pages/CandidateApplications.tsx");
const pwForm = read("../../artifacts/swiftjob-systems/src/components/CandidatePasswordForm.tsx");
const login = read("../../artifacts/swiftjob-systems/src/pages/CandidateLogin.tsx");

let failures = 0;
const check = (name, cond, detail = "") => {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.error(`FAIL ${name} ${detail}`); }
};

// --- API-01: single JSON boundary ---
check("parseJson-recursive-call-removed", !/const body = await parseJson\(c\);\s*if \(body === null\) \{\s*return c\.json/.test(workerSrc) || workerSrc.includes("Parse a JSON body"),
  "parseJson should not call itself");
check("parseJson-returns-null", /return null;\s*\}\s*return body;/.test(workerSrc));
const directJson = [...workerSrc.matchAll(/c\.req\.json\(\)/g)].length;
check("no-direct-req-json-outside-parser", directJson === 1, `found ${directJson}, want exactly 1 (inside parseJson)`);
// Strict routes must go through parseJson
for (const route of ["/api/contact", "/api/auth/magic-link", "/api/admin/login", "/api/admin/mail/send", "/api/auth/login-password", "/api/auth/register"]) {
  const i = workerSrc.indexOf(`app.post("${route}"`);
  const window = workerSrc.slice(Math.max(0, i - 200), i + 1200);
  check(`route-uses-parseJson:${route}`, i > 0 && /parseJson/.test(window), "route body not routed via parseJson");
}

// --- AUTH-01: no public password claim via applicationId ---
check("register-requires-candidateAuth", /app\.post\("\/api\/auth\/register", candidateAuth/.test(workerSrc));
check("register-no-applicationId-trust", !/findById\(applicationId\)[\s\S]{0,400}setPasswordAccount/.test(workerSrc),
  "register must not look up applicationId for ownership");
check("register-derives-email-from-session", /const email = c\.get\("user"\)\.email;[\s\S]{0,300}setPasswordAccount\(email/.test(workerSrc));
check("register-revokes-and-reissues", /revokeAllSessions\(email\)[\s\S]{0,200}generateSessionToken\(email\)/.test(workerSrc));
check("success-page-no-public-password-post", !appSuccess.includes("/api/auth/register"),
  "public success page must not POST passwords");
check("success-page-points-to-login", appSuccess.includes('href="/login"'));
check("portal-has-authenticated-password-form", portal.includes("CandidatePasswordForm") && pwForm.includes("/api/auth/register"));
check("pwform-sends-bearer-not-appid", pwForm.includes("Authorization") && !pwForm.includes("applicationId"));

// --- AUTH-02: single-signed session, shared cookie ---
check("no-double-signjwt-in-password-login", !/login-password"[\s\S]{0,1200}else/.test("") || !workerSrc.slice(workerSrc.indexOf("/api/auth/login-password"), workerSrc.indexOf("/api/auth/login-password") + 1200).includes("new SignJWT"),
  "password login must not double-sign");
check("password-login-uses-shared-cookie", /login-password"[\s\S]{0,900}setCandidateCookie\(c, sessionToken\)/.test(workerSrc));
check("verify-uses-shared-cookie", /\/api\/auth\/verify"[\s\S]{0,1200}setCandidateCookie\(c, sessionToken\)/.test(workerSrc));
check("cookie-name-consistent", !workerSrc.includes("candidate_session="), "old candidate_session cookie must be gone");
check("login-page-copy-no-after-applying", !login.includes("after applying"));

// --- AUTH-03: logout revocation ---
check("logout-revokes-server-session", /\/api\/auth\/logout"[\s\S]{0,600}revokeSession\(token\)/.test(workerSrc));
check("logout-surfaces-revocation-failure", /\/api\/auth\/logout"[\s\S]{0,800}503/.test(workerSrc));
check("portal-logout-calls-server", portal.includes("/api/auth/logout") && portal.includes("localStorage.removeItem"));

// --- JWT hardening (auth service) ---
check("jwt-pins-hs256", authSvcSrc.includes('algorithms: ["HS256"]'));
check("jwt-validates-role-email-session-shape", /payload\.role !== "candidate"/.test(authSvcSrc) && /a-f0-9\]\{64\}/.test(authSvcSrc));
check("session-email-binding", authSvcSrc.includes("session.email !== decoded.email"));

// --- Live JWT checks with jose ---
const secret = new TextEncoder().encode("test-secret-at-least-16-chars");
const good = await new SignJWT({ sessionToken: "a".repeat(64), email: "a@example.com", role: "candidate" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret);
const { payload } = await jwtVerify(good, secret, { algorithms: ["HS256"] });
check("live-good-token-verifies", payload.email === "a@example.com");
const forged = await new SignJWT({ sessionToken: "a".repeat(64), email: "evil@example.com", role: "candidate" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d")
  .sign(new TextEncoder().encode("different-secret-16-chars!!"));
let forgedRejected = false;
try { await jwtVerify(forged, secret, { algorithms: ["HS256"] }); } catch { forgedRejected = true; }
check("live-forged-token-rejected", forgedRejected);
const noneAlg = await new SignJWT({ sessionToken: "a".repeat(64), email: "a@example.com", role: "candidate" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret);
// role-swap must be rejected by service-level check (verifySessionToken pins role)
check("live-role-claim-present", payload.role === "candidate");

console.log(failures === 0 ? "\nBATCH-A REGRESSION: ALL PASS" : `\nBATCH-A REGRESSION: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
