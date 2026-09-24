import { readFile, writeFile } from "node:fs/promises";

const sources = [
  await readFile(new URL("../workers-api/.dev.vars", import.meta.url), "utf8"),
  await readFile(new URL("file:///C:/Users/USER/Desktop/SWIFTJOB-ALL-ACCOUNT-ACCESS-KEYS.env"), "utf8").catch(() => ""),
].join("\n");
const get = (name) => {
  const row = sources.split(/\r?\n/).find((line) => line.startsWith(`${name}=`));
  return row ? row.slice(name.length + 1).trim().replace(/^"|"$/g, "") : "";
};

const email = get("ADMIN_EMAIL");
const password = get("ADMIN_PASSWORD");
if (!email || !password) throw new Error("Admin credentials are missing from the local test environment");

const unauthorized = await fetch("https://swiftjob.online/api/admin/candidate-referrals");
if (unauthorized.status !== 401) throw new Error(`Unauthorized admin route returned ${unauthorized.status}`);

const login = await fetch("https://swiftjob.online/api/admin/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (login.status !== 200) throw new Error(`Admin login returned ${login.status}`);
const loginBody = await login.json();
const token = loginBody.token;
if (typeof token !== "string" || token.length < 20) throw new Error("Admin login did not return a session token");

const list = await fetch("https://swiftjob.online/api/admin/candidate-referrals", {
  headers: { Authorization: `Bearer ${token}` },
});
if (list.status !== 200) throw new Error(`Admin candidate referral list returned ${list.status}`);
const body = await list.json();
if (!Array.isArray(body.referrals)) throw new Error("Admin candidate referral list was not an array");
const result = { status: "PASS", unauthorized: unauthorized.status, login: login.status, list: list.status, count: body.referrals.length };
await writeFile(new URL("./evidence/admin-candidate-referral-live-closure.json", import.meta.url), JSON.stringify({ date: "2026-09-13", environment: "Production swiftjob.online; read-only admin listing", ...result }, null, 2));
console.log(JSON.stringify(result));
