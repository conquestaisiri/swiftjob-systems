import { mkdir, writeFile } from "node:fs/promises";

const origin = "https://swiftjob.online";
const sitemapUrl = `${origin}/sitemap.xml`;
const xml = await (await fetch(sitemapUrl)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const results = [];
let cursor = 0;

async function checkNext() {
  while (cursor < urls.length) {
    const index = cursor++;
    const url = urls[index];
    const started = Date.now();
    try {
      const response = await fetch(url, { redirect: "manual" });
      const body = await response.text();
      const canonical =
        body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] ??
        null;
      const expectedCanonical = new URL(new URL(url).pathname, origin).href;
      results[index] = {
        url,
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
        ms: Date.now() - started,
        hasTitle: /<title[^>]*>[^<]+<\/title>/i.test(body),
        canonical,
        canonicalMatches: canonical === expectedCanonical,
      };
    } catch (error) {
      results[index] = { url, error: String(error) };
    }
  }
}

await Promise.all(Array.from({ length: 8 }, () => checkNext()));
const failures = results.filter(
  (result) =>
    result.status !== 200 ||
    !result.hasTitle ||
    !result.canonical ||
    !result.canonicalMatches,
);
const evidence = {
  checkedAt: new Date().toISOString(),
  origin,
  sitemapUrl,
  urlCount: results.length,
  failureCount: failures.length,
  averageResponseMs: Math.round(
    results.reduce((sum, result) => sum + (result.ms ?? 0), 0) /
      Math.max(results.length, 1),
  ),
  failures,
  results,
};

await mkdir("AUDIT/evidence", { recursive: true });
await writeFile(
  "AUDIT/evidence/public-route-crawl.json",
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);
console.log(
  JSON.stringify({
    status: failures.length === 0 ? "PASS" : "FAIL",
    urlCount: results.length,
    failureCount: failures.length,
    averageResponseMs: evidence.averageResponseMs,
  }),
);

if (failures.length > 0) process.exitCode = 1;
