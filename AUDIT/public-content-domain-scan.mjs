import { mkdir, writeFile } from "node:fs/promises";

const origin = "https://swiftjob.online";
const legacyPatterns = [/swiftjob\.payservice\.top/gi, /payservice\.top/gi, /two countries/gi];
const sitemapUrl = `${origin}/sitemap.xml`;
const sitemapResponse = await fetch(sitemapUrl, { headers: { "user-agent": "SwiftJob-audit/1.0" } });
if (!sitemapResponse.ok) throw new Error(`Sitemap returned ${sitemapResponse.status}`);
const xml = await sitemapResponse.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const results = [];
let cursor = 0;

async function checkNext() {
  while (cursor < urls.length) {
    const index = cursor++;
    const url = urls[index];
    const started = Date.now();
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "SwiftJob-audit/1.0" },
        redirect: "manual",
      });
      const body = await response.text();
      const matches = legacyPatterns.flatMap((pattern) => [...body.matchAll(pattern)].map((match) => match[0].toLowerCase()));
      results[index] = {
        url,
        status: response.status,
        ms: Date.now() - started,
        contentType: response.headers.get("content-type") ?? "",
        hasTitle: /<title[^>]*>[^<]+<\/title>/i.test(body),
        legacyMatches: [...new Set(matches)],
      };
    } catch (error) {
      results[index] = { url, error: String(error), legacyMatches: [] };
    }
  }
}

await Promise.all(Array.from({ length: 8 }, () => checkNext()));
const failures = results.filter((result) =>
  result.status !== 200 ||
  !result.hasTitle ||
  result.legacyMatches.length > 0,
);
const evidence = {
  checkedAt: new Date().toISOString(),
  origin,
  sitemapUrl,
  urlCount: results.length,
  failureCount: failures.length,
  legacyDomainPageCount: results.filter((result) => result.legacyMatches.some((match) => match.includes("payservice.top"))).length,
  retiredCopyPageCount: results.filter((result) => result.legacyMatches.includes("two countries")).length,
  failures,
  results,
};
await mkdir("AUDIT/evidence", { recursive: true });
await writeFile("AUDIT/evidence/public-content-domain-scan.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: failures.length === 0 ? "PASS" : "FAIL",
  urlCount: results.length,
  failureCount: failures.length,
  legacyDomainPageCount: evidence.legacyDomainPageCount,
  retiredCopyPageCount: evidence.retiredCopyPageCount,
}));
if (failures.length > 0) process.exitCode = 1;
